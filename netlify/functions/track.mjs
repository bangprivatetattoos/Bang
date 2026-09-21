import { classifyDevice, classifyPlatform, json, sameOrigin, sanitizeText, serverConfig, sourceHash } from "../lib/server-security.mjs";

const EVENTS = new Set([
  "page_view", "artist_view", "artist_gallery_open", "book_artist_click",
  "portfolio_view", "portfolio_image_open", "booking_start", "booking_success",
  "whatsapp_click", "whatsapp_handoff", "home_call_view", "home_call_click", "faq_open",
  // Immersive video feed events.
  "content_view", "video_started", "video_completed", "video_swiped",
  "reaction", "comment_open", "comment_submit", "artist_open", "gallery_open",
  "booking_started", "location_selected", "artist_selected",
  "tattoo_type_selected", "price_range_selected", "whatsapp_continue",
  "carousel_view", "carousel_interaction",
  "video_paused", "video_resumed", "video_auto_advanced",
  "artist_gallery_booking_open", "artist_gallery_enquiry_open",
  "video_3s_view", "video_25_percent", "video_50_percent", "video_75_percent",
  "video_swiped_forward", "video_swiped_back", "video_replayed", "video_reaction_added",
  "video_reaction_removed", "comment_submitted", "artist_avatar_clicked", "artist_dropdown_open",
  "artist_gallery_view", "artist_video_interaction", "artist_booking_selected", "artist_changed_during_booking",
  "artist_whatsapp_continue", "consultation_acknowledgement_viewed", "carousel_shown", "carousel_image_impression",
  "carousel_manual_swipe", "carousel_auto_advance", "carousel_completed", "carousel_swipe_up_continue",
  "carousel_swipe_back", "carousel_image_clicked", "carousel_artist_clicked",
  // Feed sound session.
  "sound_activation_prompt_shown", "sound_enabled", "sound_disabled", "sound_playback_blocked",
]);
// Metadata is an allow-list so no feed interaction can widen what is stored.
// Every value here is non-identifying: no free text a visitor typed about
// themselves, and no contact detail, ever reaches analytics.
const METADATA_KEYS = new Set([
  "artist_name", "video_id", "reaction", "tattoo_type", "price_range",
  "direction", "surface", "navigation_method", "carousel_batch_id",
  "content_id", "milestone", "artist_id",
  // Non-identifying context for the sound session: why sound changed.
  // Never free text.
  "reason",
]);
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
  // One atomic upsert. The previous read-then-write let two concurrent first
  // requests both see "absent" and both insert, and its update branch touched
  // only last_seen_at, so a row created anywhere else was never enriched.
  // `ensure_analytics_session` fills blanks and never overwrites.
  const sessionResult = await config.client.rpc("ensure_analytics_session", {
    p_id: sessionId,
    p_visitor_id: visitorId,
    p_landing_path: session.landing_path,
    p_referrer: session.referrer,
    p_utm_source: session.utm_source,
    p_utm_medium: session.utm_medium,
    p_utm_campaign: session.utm_campaign,
    p_utm_content: session.utm_content,
    p_utm_term: session.utm_term,
    p_country: session.country,
    p_country_code: session.country_code,
    p_region: session.region,
    p_region_code: session.region_code,
    p_city: session.city,
    p_device_type: session.device_type,
    p_operating_system: session.operating_system,
    p_browser: session.browser,
  });
  if (sessionResult.error) return json(500, { error: "server_error" });
  const safeMetadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? Object.fromEntries(Object.entries(body.metadata).filter(([key, value]) => METADATA_KEYS.has(key) && typeof value === "string" && value.length <= 120)) : {};
  const result = await config.client.from("analytics_events").insert({ client_event_id: clientEventId, session_id: sessionId, event_name: eventName, page_path: pagePath, entity_type: sanitizeText(body.entityType, 64), entity_id: sanitizeText(body.entityId, 160), metadata: safeMetadata });
  if (result.error && result.error.code !== "23505") return json(500, { error: "server_error" });
  return json(202, { ok: true });
};
