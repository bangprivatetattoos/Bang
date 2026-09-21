// Reactions on individual comments.
//
// Keyed by comment id and the anonymous visitor id, so one visitor holds at
// most one reaction per comment and repeated tapping cannot inflate a total.
// Tapping again removes it. The raw rows stay private; the public total lives
// in comment_reaction_counts, which a trigger keeps in step.
import { json, sameOrigin, serverConfig } from "../lib/server-security.mjs";
import { feedSourceHash, readJson, UUID_PATTERN } from "../lib/feed-validation.mjs";

const MAX_BODY_BYTES = 1_000;
const KINDS = new Set(["like", "love"]);
/** Reaction writes allowed per visitor per minute. */
const WRITE_LIMIT = 40;

async function state(client, commentId, visitorId) {
  const [count, mine] = await Promise.all([
    client.from("comment_reaction_counts").select("reaction_count").eq("comment_id", commentId).maybeSingle(),
    visitorId
      ? client.from("comment_reactions").select("reaction").eq("comment_id", commentId).eq("anonymous_visitor_id", visitorId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return json(200, {
    commentId,
    reactionCount: count.data?.reaction_count ?? 0,
    mine: mine.data?.reaction ?? null,
  });
}

export default async (request, context) => {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "reactions_not_configured" });
  const client = config.client;

  if (request.method === "GET") {
    const params = new URL(request.url).searchParams;
    const commentId = params.get("commentId") ?? "";
    const visitorId = params.get("visitorId") ?? "";
    if (!UUID_PATTERN.test(commentId)) return json(400, { error: "invalid_request" });
    return state(client, commentId, UUID_PATTERN.test(visitorId) ? visitorId : null);
  }

  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  const parsed = await readJson(request, MAX_BODY_BYTES);
  if (parsed.error) return json(parsed.status, { error: parsed.error });
  const { commentId, visitorId, reaction } = parsed.body ?? {};

  if (!UUID_PATTERN.test(commentId ?? "") || !UUID_PATTERN.test(visitorId ?? "")) {
    return json(400, { error: "invalid_request" });
  }
  // `null` clears this visitor's reaction.
  if (reaction !== null && !KINDS.has(reaction)) return json(400, { error: "invalid_request" });

  const limitKey = feedSourceHash("comment-reaction", context, request, config.lockoutSecret);
  const limited = await client.rpc("consume_analytics_rate_limit", { p_source_hash: limitKey, p_limit: WRITE_LIMIT });
  if (limited.error || !limited.data) return json(429, { error: "rate_limited" });

  // A reaction may only attach to a comment the public can actually see.
  const parent = await client.from("content_comments").select("id").eq("id", commentId).eq("status", "visible").maybeSingle();
  if (parent.error || !parent.data) return json(404, { error: "not_found" });

  const written = reaction === null
    ? await client.from("comment_reactions").delete().eq("comment_id", commentId).eq("anonymous_visitor_id", visitorId)
    : await client.from("comment_reactions").upsert(
        { comment_id: commentId, anonymous_visitor_id: visitorId, reaction, is_official: false, updated_at: new Date().toISOString() },
        { onConflict: "comment_id,anonymous_visitor_id" },
      );

  if (written.error) {
    console.error("comment-reactions: write failed", written.error.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  return state(client, commentId, visitorId);
};
