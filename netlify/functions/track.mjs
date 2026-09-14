import { classifyDevice, classifyPlatform, json, sameOrigin, sanitizeText, serverConfig, sourceHash } from "../lib/server-security.mjs";

const EVENTS = new Set(["page_view", "artist_view", "artist_gallery_open", "book_artist_click", "portfolio_view", "portfolio_image_open", "booking_start", "booking_success", "whatsapp_click", "home_call_view", "home_call_click", "faq_open"]);
const MAX_BODY_BYTES = 8_000;

export default async (request, context) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "analytics_not_configured" });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });
  let body;
  try { const raw = await request.text(); if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" }); body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const eventName = sanitizeText(body?.eventName, 64);
  const sessionId = sanitizeText(body?.sessionId, 36); const visitorId = sanitizeText(body?.visitorId, 36); const clientEventId = sanitizeText(body?.eventId, 36); const pagePath = sanitizeText(body?.pagePath, 500);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!EVENTS.has(eventName) || !uuid.test(sessionId ?? "") || !uuid.test(visitorId ?? "") || !uuid.test(clientEventId ?? "") || !pagePath?.startsWith("/")) return json(400, { error: "invalid_request" });
  const hashedSource = sourceHash(context, request, config.lockoutSecret);
  const rate = await config.client.rpc("consume_analytics_rate_limit", { p_source_hash: hashedSource, p_limit: 120 });
  if (rate.error || !rate.data) return json(429, { error: "rate_limited" });
  const attribution = body.attribution ?? {}; const ua = request.headers.get("user-agent") ?? ""; const platform = classifyPlatform(ua); const geo = context.geo ?? {};
  const session = {
    id: sessionId, visitor_id: visitorId, started_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), landing_path: sanitizeText(body.landingPath, 500) ?? pagePath,
    referrer: sanitizeText(body.referrer, 2048), utm_source: sanitizeText(attribution.source, 200), utm_medium: sanitizeText(attribution.medium, 200), utm_campaign: sanitizeText(attribution.campaign, 300), utm_content: sanitizeText(attribution.content, 300), utm_term: sanitizeText(attribution.term, 300),
    country: sanitizeText(geo.country?.name, 100), country_code: sanitizeText(geo.country?.code, 8), region: sanitizeText(geo.subdivision?.name, 100), region_code: sanitizeText(geo.subdivision?.code, 16), city: sanitizeText(geo.city, 100), device_type: classifyDevice(ua), operating_system: platform.operatingSystem, browser: platform.browser,
  };
  const existing = await config.client.from("analytics_sessions").select("id").eq("id", sessionId).maybeSingle();
  if (existing.error) return json(500, { error: "server_error" });
  const sessionResult = existing.data ? await config.client.from("analytics_sessions").update({ last_seen_at: session.last_seen_at }).eq("id", sessionId) : await config.client.from("analytics_sessions").insert(session);
  if (sessionResult.error) return json(500, { error: "server_error" });
  const safeMetadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? Object.fromEntries(Object.entries(body.metadata).filter(([key, value]) => /^[a-z_]{1,40}$/.test(key) && typeof value === "string" && value.length <= 120)) : {};
  const result = await config.client.from("analytics_events").insert({ client_event_id: clientEventId, session_id: sessionId, event_name: eventName, page_path: pagePath, entity_type: sanitizeText(body.entityType, 64), entity_id: sanitizeText(body.entityId, 160), metadata: safeMetadata });
  if (result.error && result.error.code !== "23505") return json(500, { error: "server_error" });
  return json(202, { ok: true });
};
