// Reactions on video feed content.
//
// Anonymous by construction: a reaction is keyed by the content id and the
// browser-generated analytics visitor id, which carries no identity and is
// never joined to a booking or a comment contact.
import { json, sameOrigin, serverConfig } from "../lib/server-security.mjs";
import { feedSourceHash, readJson, UUID_PATTERN, validContentId } from "../lib/feed-validation.mjs";

const MAX_BODY_BYTES = 1_000;
const KINDS = new Set(["like", "love"]);
/** Reaction writes allowed per visitor per minute. */
const WRITE_LIMIT = 30;

async function counts(client, contentId) {
  const results = await Promise.all(
    [...KINDS].map(async (reaction) => {
      const { count, error } = await client
        .from("content_reactions")
        .select("content_id", { count: "exact", head: true })
        .eq("content_id", contentId)
        .eq("reaction", reaction);
      return { reaction, count: error ? null : count ?? 0, error };
    }),
  );
  if (results.some((result) => result.error)) return null;
  return Object.fromEntries(results.map((result) => [result.reaction, result.count]));
}

async function readState(client, contentId, visitorId) {
  const totals = await counts(client, contentId);
  if (!totals) return json(500, { error: "server_error" });

  let mine = null;
  if (visitorId) {
    const { data } = await client
      .from("content_reactions")
      .select("reaction")
      .eq("content_id", contentId)
      .eq("visitor_id", visitorId)
      .maybeSingle();
    mine = data?.reaction ?? null;
  }
  return json(200, { counts: totals, mine });
}

export default async (request, context) => {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "reactions_not_configured" });
  const client = config.client;

  if (request.method === "GET") {
    const params = new URL(request.url).searchParams;
    const contentId = params.get("contentId") ?? "";
    const visitorId = params.get("visitorId") ?? "";
    if (!validContentId(contentId)) return json(400, { error: "invalid_request" });
    return readState(client, contentId, UUID_PATTERN.test(visitorId) ? visitorId : null);
  }

  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  const parsed = await readJson(request, MAX_BODY_BYTES);
  if (parsed.error) return json(parsed.status, { error: parsed.error });
  const { contentId, visitorId, reaction } = parsed.body ?? {};

  if (!validContentId(contentId) || typeof visitorId !== "string" || !UUID_PATTERN.test(visitorId)) {
    return json(400, { error: "invalid_request" });
  }
  // `null` clears the visitor's reaction.
  if (reaction !== null && !KINDS.has(reaction)) return json(400, { error: "invalid_request" });

  const limitKey = feedSourceHash("feed-reaction", context, request, config.lockoutSecret);
  const limited = await client.rpc("consume_analytics_rate_limit", { p_source_hash: limitKey, p_limit: WRITE_LIMIT });
  if (limited.error || !limited.data) return json(429, { error: "rate_limited" });

  const written = reaction === null
    ? await client.from("content_reactions").delete().eq("content_id", contentId).eq("visitor_id", visitorId)
    : await client.from("content_reactions").upsert(
        { content_id: contentId, visitor_id: visitorId, reaction, updated_at: new Date().toISOString() },
        { onConflict: "content_id,visitor_id" },
      );

  if (written.error) {
    console.error("content-reactions: write failed", written.error.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  return readState(client, contentId, visitorId);
};
