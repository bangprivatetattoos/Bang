// Public comments on video feed content.
//
// Ordinary comments ask for nothing but the text. A name is optional and a
// blank one renders as "Anonymous"; no phone number or email address is
// requested or stored here — that belongs to the separate, private enquiry
// flow. Comments are visible on submission and moderated after the fact.
//
// Reads return published text, its official reply and its reaction total.
// Nothing in the response identifies who wrote or reacted to anything.
import { json, sameOrigin, serverConfig } from "../lib/server-security.mjs";
import { cleanMultiline, cleanText, feedSourceHash, readJson, UUID_PATTERN, validContentId } from "../lib/feed-validation.mjs";
import { commentEmail, recordAdminAlert } from "../lib/engagement.mjs";

const MAX_BODY_BYTES = 8_000;
const PAGE_SIZE = 50;
/** Comment submissions allowed per visitor per minute. */
const WRITE_LIMIT = 4;
const MIN_COMMENT_LENGTH = 2;
const MAX_COMMENT_LENGTH = 1200;
/** An identical comment on the same clip within this window is a double-post. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/** The only comment columns ever sent to a browser. */
const PUBLIC_COLUMNS = "id,display_name,comment,created_at";

/**
 * Strips anything that could be interpreted as markup.
 *
 * The client renders comment bodies as text nodes, never as HTML, so this is
 * defence in depth rather than the only guard.
 */
function stripMarkup(value) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ") : value;
}

async function listComments(client, contentId) {
  const { data, error } = await client
    .from("content_comments")
    .select(PUBLIC_COLUMNS)
    .eq("content_id", contentId)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (error) return json(500, { error: "server_error" });

  const rows = data ?? [];
  const ids = rows.map((row) => row.id);

  // Reaction totals and official replies, fetched in two set-based queries
  // rather than one per comment.
  const [counts, replies] = await Promise.all([
    ids.length
      ? client.from("comment_reaction_counts").select("comment_id,reaction_count").in("comment_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? client.from("comment_replies").select("id,comment_id,body,created_at").in("comment_id", ids).eq("status", "visible").order("created_at")
      : Promise.resolve({ data: [] }),
  ]);

  const countBy = new Map((counts.data ?? []).map((row) => [row.comment_id, row.reaction_count]));
  const replyBy = new Map();
  for (const reply of replies.data ?? []) {
    if (!replyBy.has(reply.comment_id)) replyBy.set(reply.comment_id, []);
    replyBy.get(reply.comment_id).push({ id: reply.id, body: reply.body, createdAt: reply.created_at });
  }

  return json(200, {
    comments: rows.map((row) => ({
      id: row.id,
      // A blank name is rendered as Anonymous by the client; the server sends
      // null rather than inventing a display name.
      displayName: row.display_name,
      comment: row.comment,
      createdAt: row.created_at,
      reactionCount: countBy.get(row.id) ?? 0,
      replies: replyBy.get(row.id) ?? [],
    })),
  });
}

async function createComment(client, config, request, context, body) {
  const contentId = typeof body?.contentId === "string" ? body.contentId : "";
  const displayName = cleanText(stripMarkup(body?.displayName), 60);
  const comment = cleanMultiline(stripMarkup(body?.comment), MAX_COMMENT_LENGTH);
  const visitorId = typeof body?.visitorId === "string" && UUID_PATTERN.test(body.visitorId) ? body.visitorId : null;

  const fields = {};
  if (!validContentId(contentId)) fields.contentId = "Unknown content";
  if (!comment || comment.length < MIN_COMMENT_LENGTH) fields.comment = "Please write a comment";
  if (Object.keys(fields).length) return json(400, { error: "invalid_request", fields });

  const limitKey = feedSourceHash("feed-comment", context, request, config.lockoutSecret);
  const limited = await client.rpc("consume_analytics_rate_limit", { p_source_hash: limitKey, p_limit: WRITE_LIMIT });
  if (limited.error || !limited.data) return json(429, { error: "rate_limited" });

  // Double-post guard: the same visitor posting identical text on the same
  // clip within the window is treated as a repeat, not a new comment.
  if (visitorId) {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const duplicate = await client
      .from("content_comments")
      .select("id")
      .eq("content_id", contentId)
      .eq("anonymous_visitor_id", visitorId)
      .eq("comment", comment)
      .gte("created_at", since)
      .maybeSingle();
    if (duplicate.data) return json(200, { ok: true, status: "visible", duplicate: true });
  }

  let analyticsSessionId = typeof body?.analyticsSessionId === "string" && UUID_PATTERN.test(body.analyticsSessionId) ? body.analyticsSessionId : null;
  if (analyticsSessionId) {
    const session = await client.from("analytics_sessions").select("id").eq("id", analyticsSessionId).maybeSingle();
    if (session.error || !session.data) analyticsSessionId = null;
  }

  const inserted = await client
    .from("content_comments")
    .insert({
      content_id: contentId,
      display_name: displayName,
      comment,
      status: "visible",
      anonymous_visitor_id: visitorId,
      analytics_session_id: analyticsSessionId,
    })
    .select("id,display_name,comment,content_id,created_at")
    .maybeSingle();

  if (inserted.error || !inserted.data) {
    console.error("content-comments: insert failed", inserted.error?.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  const row = inserted.data;
  const mail = commentEmail({
    displayName: row.display_name,
    comment: row.comment,
    contentId: row.content_id,
    createdAt: row.created_at,
  });
  // Alerting must never fail the comment, so this is awaited but its result is
  // not allowed to change the response.
  await recordAdminAlert(client, {
    type: "comment",
    dedupeKey: `comment:${row.id}`,
    title: "New comment",
    summary: `${row.display_name ?? "Anonymous"} commented on ${row.content_id}: "${row.comment.slice(0, 120)}"`,
    entityType: "comment",
    entityId: row.id,
    contentId: row.content_id,
    emailSubject: mail.subject,
    emailBody: mail.body,
  });

  return json(201, {
    ok: true,
    status: "visible",
    comment: {
      id: row.id,
      displayName: row.display_name,
      comment: row.comment,
      createdAt: row.created_at,
      reactionCount: 0,
      replies: [],
    },
  });
}

export default async (request, context) => {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "comments_not_configured" });

  if (request.method === "GET") {
    const contentId = new URL(request.url).searchParams.get("contentId") ?? "";
    if (!validContentId(contentId)) return json(400, { error: "invalid_request" });
    return listComments(config.client, contentId);
  }

  if (request.method === "POST") {
    const parsed = await readJson(request, MAX_BODY_BYTES);
    if (parsed.error) return json(parsed.status, { error: parsed.error });
    return createComment(config.client, config, request, context, parsed.body);
  }

  return json(405, { error: "method_not_allowed" });
};
