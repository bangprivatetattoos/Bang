// Aggregated feed analytics ingestion.
//
// Takes one session summary instead of the hundreds of individual rows that
// swipes, pauses, playback milestones and carousel movement used to produce.
// Business and funnel events still go to `track`, individually — this endpoint
// deliberately cannot record them.
//
// Everything here is a bounded number. There is no free-text field in the
// accepted shape at all: no name, no message, no comment, no contact detail,
// and no way to smuggle one in, because any key not on the allow-list below is
// dropped before the payload is looked at again.
import { classifyDevice, classifyPlatform, json, sameOrigin, sanitizeText, serverConfig, sourceHash } from "../lib/server-security.mjs";

const MAX_BODY_BYTES = 16_000;
/** A session cannot meaningfully touch more clips than the library holds. */
const MAX_CONTENT_ENTRIES = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The only session counters that exist, with their ceilings.
 *
 * An allow-list rather than a filter: a key that is not here never reaches the
 * database, whatever it is called and whatever it contains.
 */
const SESSION_COUNTERS = {
  forwardSwipes: 100_000,
  backwardSwipes: 100_000,
  videosEntered: 100_000,
  uniqueVideosViewed: 100_000,
  qualifiedVideoViews: 100_000,
  videosCompleted: 100_000,
  videosReplayed: 100_000,
  // 24 hours. Anything longer is a stuck clock, not a session.
  totalWatchSeconds: 86_400,
  maximumFeedDepth: 100_000,
  carouselsViewed: 100_000,
  carouselImagesViewed: 100_000,
  carouselManualSwipes: 100_000,
  artistProfilesViewed: 100_000,
  bookingStarted: 10_000,
  whatsappContinued: 10_000,
};

const CONTENT_COUNTERS = {
  impressions: 100_000,
  qualifiedViews: 100_000,
  completions: 100_000,
  replays: 100_000,
  watchSeconds: 86_400,
};

/** A whole number inside its ceiling, or zero. Never NaN, never negative. */
function counter(value, ceiling) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Math.floor(number), ceiling);
}

function cleanSummary(input) {
  const out = {};
  for (const [key, ceiling] of Object.entries(SESSION_COUNTERS)) {
    out[key] = counter(input?.[key], ceiling);
  }
  return out;
}

function cleanContent(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const entry of input.slice(0, MAX_CONTENT_ENTRIES)) {
    const contentId = typeof entry?.contentId === "string" ? entry.contentId.trim() : "";
    // The feed's stable slug shape. Rejecting anything else keeps this from
    // becoming a free-text column by another name.
    if (!contentId || contentId.length > 160 || !/^[a-z0-9][a-z0-9._-]*$/i.test(contentId)) continue;
    const row = { contentId };
    for (const [key, ceiling] of Object.entries(CONTENT_COUNTERS)) {
      row[key] = counter(entry?.[key], ceiling);
    }
    out.push(row);
  }
  return out;
}

export default async (request, context) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });

  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "analytics_not_configured" });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json(413, { error: "payload_too_large" });
  }

  let body;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!UUID.test(sessionId)) return json(400, { error: "invalid_request" });

  // Same limiter the event endpoint uses. Summaries are far rarer than events,
  // so a generous share of the same budget is plenty.
  const rate = await config.client.rpc("consume_analytics_rate_limit", {
    p_source_hash: sourceHash(context, request, config.lockoutSecret),
    p_limit: 120,
  });
  if (rate.error || !rate.data) return json(429, { error: "rate_limited" });

  // A summary used to be refused when no session row existed yet, because
  // page_view had not landed. It creates the row itself now, so ingestion no
  // longer depends on the order the two requests arrive in. Device and
  // geography are read from the request rather than trusted from the body;
  // the visitor id, landing path, referrer and campaign are things only the
  // browser knows, so those are accepted and validated.
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
  if (!UUID.test(visitorId)) return json(400, { error: "invalid_request" });

  const attribution = body?.attribution ?? {};
  const userAgent = request.headers.get("user-agent") ?? "";
  const platform = classifyPlatform(userAgent);
  const geo = context.geo ?? {};

  const ensured = await config.client.rpc("ensure_analytics_session", {
    p_id: sessionId,
    p_visitor_id: visitorId,
    p_landing_path: sanitizeText(body?.landingPath, 500) ?? "/",
    p_referrer: sanitizeText(body?.referrer, 2048),
    p_utm_source: sanitizeText(attribution.source, 200),
    p_utm_medium: sanitizeText(attribution.medium, 200),
    p_utm_campaign: sanitizeText(attribution.campaign, 300),
    p_utm_content: sanitizeText(attribution.content, 300),
    p_utm_term: sanitizeText(attribution.term, 300),
    p_country: sanitizeText(geo.country?.name, 100),
    p_country_code: sanitizeText(geo.country?.code, 8),
    p_region: sanitizeText(geo.subdivision?.name, 100),
    p_region_code: sanitizeText(geo.subdivision?.code, 16),
    p_city: sanitizeText(geo.city, 100),
    p_device_type: classifyDevice(userAgent),
    p_operating_system: platform.operatingSystem,
    p_browser: platform.browser,
  });
  if (ensured.error) {
    console.error("analytics-summary: ensure failed", ensured.error.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  const summary = cleanSummary(body?.summary);
  const content = cleanContent(body?.content);

  const applied = await config.client.rpc("apply_analytics_session_summary", {
    p_session_id: sessionId,
    p_summary: summary,
    p_content: content,
  });

  if (applied.error) {
    // Code only. An analytics fault is never worth leaking query detail over.
    console.error("analytics-summary: apply failed", applied.error.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  // The row is ensured immediately above, so this should no longer be
  // reachable. Kept as a guard rather than deleted: if it ever fires, the
  // client still keeps its totals — they are absolute — and the next flush
  // lands them, which is strictly better than reporting success.
  if (applied.data === false) return json(409, { error: "session_not_ready" });

  return json(202, { ok: true });
};
