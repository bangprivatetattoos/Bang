// Admin comment moderation: reply, react, hide, restore, delete.
//
// Behind the existing admin session cookie. An official reply and an official
// reaction can only originate here — there is no anon grant on comment_replies
// and the public reaction endpoint always writes `is_official: false`, so a
// visitor cannot forge studio engagement.
//
// Moderation is soft by default: hiding and deleting set a status, so the
// audit trail survives. Permanent removal is a separate, explicit action.
import { json, sameOrigin, serverConfig, verifyAdminSession } from "../lib/server-security.mjs";
import { cleanMultiline, readJson, UUID_PATTERN } from "../lib/feed-validation.mjs";

const MAX_BODY_BYTES = 8_000;
const PAGE_SIZE = 25;

/** The studio's own visitor id for official reactions, fixed and reserved. */
const OFFICIAL_VISITOR_ID = "00000000-0000-4000-8000-000000000001";

const ACTIONS = new Set(["reply", "react", "unreact", "hide", "restore", "delete", "purge"]);
const STATUSES = new Set(["visible", "hidden", "deleted"]);

const stripMarkup = (value) => (typeof value === "string" ? value.replace(/<[^>]*>/g, " ") : value);

async function list(client, url) {
  const params = url.searchParams;
  const status = params.get("status");
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get("pageSize") ?? String(PAGE_SIZE), 10) || PAGE_SIZE));

  let query = client
    .from("content_comments")
    .select("id,content_id,display_name,comment,status,created_at", { count: "exact" });
  if (status && STATUSES.has(status)) query = query.eq("status", status);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) {
    console.error("admin-comments: list failed", error.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  const rows = data ?? [];
  const ids = rows.map((row) => row.id);
  const [counts, replies, official] = await Promise.all([
    ids.length ? client.from("comment_reaction_counts").select("comment_id,reaction_count").in("comment_id", ids) : { data: [] },
    ids.length ? client.from("comment_replies").select("id,comment_id,body,status,created_at").in("comment_id", ids).order("created_at") : { data: [] },
    ids.length ? client.from("comment_reactions").select("comment_id").in("comment_id", ids).eq("is_official", true) : { data: [] },
  ]);

  const countBy = new Map((counts.data ?? []).map((row) => [row.comment_id, row.reaction_count]));
  const officialSet = new Set((official.data ?? []).map((row) => row.comment_id));
  const replyBy = new Map();
  for (const reply of replies.data ?? []) {
    if (!replyBy.has(reply.comment_id)) replyBy.set(reply.comment_id, []);
    replyBy.get(reply.comment_id).push({ id: reply.id, body: reply.body, status: reply.status, createdAt: reply.created_at });
  }

  return json(200, {
    comments: rows.map((row) => ({
      id: row.id,
      contentId: row.content_id,
      displayName: row.display_name,
      comment: row.comment,
      status: row.status,
      createdAt: row.created_at,
      reactionCount: countBy.get(row.id) ?? 0,
      officiallyReacted: officialSet.has(row.id),
      replies: replyBy.get(row.id) ?? [],
    })),
    total: count ?? 0,
    page,
    pageSize,
  });
}

async function mutate(client, body) {
  const { action, commentId } = body ?? {};
  if (!ACTIONS.has(action) || !UUID_PATTERN.test(commentId ?? "")) return json(400, { error: "invalid_request" });

  const parent = await client.from("content_comments").select("id,status").eq("id", commentId).maybeSingle();
  if (parent.error || !parent.data) return json(404, { error: "not_found" });

  const now = new Date().toISOString();

  if (action === "reply") {
    const reply = cleanMultiline(stripMarkup(body.body), 2000);
    if (!reply) return json(400, { error: "invalid_request", fields: { body: "Write a reply" } });
    const inserted = await client
      .from("comment_replies")
      .insert({ comment_id: commentId, author_type: "admin", body: reply })
      .select("id,body,created_at")
      .maybeSingle();
    if (inserted.error) {
      console.error("admin-comments: reply failed", inserted.error.code ?? "unknown");
      return json(500, { error: "server_error" });
    }
    return json(201, { ok: true, reply: { id: inserted.data.id, body: inserted.data.body, createdAt: inserted.data.created_at } });
  }

  if (action === "react" || action === "unreact") {
    // Stored as a genuine reaction flagged official, so the studio's
    // engagement is never counted or displayed as an anonymous visitor's.
    const written = action === "react"
      ? await client.from("comment_reactions").upsert(
          { comment_id: commentId, anonymous_visitor_id: OFFICIAL_VISITOR_ID, reaction: "love", is_official: true, updated_at: now },
          { onConflict: "comment_id,anonymous_visitor_id" },
        )
      : await client.from("comment_reactions").delete().eq("comment_id", commentId).eq("anonymous_visitor_id", OFFICIAL_VISITOR_ID);
    if (written.error) {
      console.error("admin-comments: official reaction failed", written.error.code ?? "unknown");
      return json(500, { error: "server_error" });
    }
    return json(200, { ok: true, officiallyReacted: action === "react" });
  }

  if (action === "purge") {
    // The one destructive path, reached only by an explicit confirmed choice.
    const removed = await client.from("content_comments").delete().eq("id", commentId);
    if (removed.error) {
      console.error("admin-comments: purge failed", removed.error.code ?? "unknown");
      return json(500, { error: "server_error" });
    }
    return json(200, { ok: true, purged: true });
  }

  const status = action === "hide" ? "hidden" : action === "restore" ? "visible" : "deleted";
  const patch = {
    status,
    updated_at: now,
    hidden_at: status === "hidden" ? now : null,
    deleted_at: status === "deleted" ? now : null,
  };
  const { error } = await client.from("content_comments").update(patch).eq("id", commentId);
  if (error) {
    console.error("admin-comments: status change failed", action, error.code ?? "unknown");
    return json(500, { error: "server_error" });
  }
  return json(200, { ok: true, status });
}

export default async (request) => {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "not_configured" });

  const session = await verifyAdminSession(request, config);
  if (!session.ok) return json(401, { error: "unauthorized" });

  if (request.method === "GET") return list(config.client, new URL(request.url));

  if (request.method === "POST") {
    const parsed = await readJson(request, MAX_BODY_BYTES);
    if (parsed.error) return json(parsed.status, { error: parsed.error });
    return mutate(config.client, parsed.body);
  }

  return json(405, { error: "method_not_allowed" });
};
