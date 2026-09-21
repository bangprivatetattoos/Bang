export type AnalyticsEventName =
  // Established events. The protected analytics dashboard reads these by name,
  // so they keep their existing spelling and meaning.
  | "page_view" | "artist_view" | "artist_gallery_open" | "book_artist_click"
  | "portfolio_view" | "portfolio_image_open" | "booking_start" | "booking_success"
  | "whatsapp_click" | "whatsapp_handoff" | "home_call_view" | "home_call_click" | "faq_open"
  // Immersive video feed. Added alongside the events above rather than
  // replacing them, so existing dashboard metrics continue to report.
  | "content_view" | "video_started" | "video_completed" | "video_swiped"
  | "reaction" | "comment_open" | "comment_submit"
  | "artist_open" | "gallery_open"
  | "booking_started" | "location_selected" | "artist_selected"
  | "tattoo_type_selected" | "price_range_selected" | "whatsapp_continue"
  | "carousel_view" | "carousel_interaction"
  // Playback control and artist-gallery contact routing.
  | "video_paused" | "video_resumed" | "video_auto_advanced"
  | "artist_gallery_booking_open" | "artist_gallery_enquiry_open"
  // Expanded content, artist, booking-funnel and carousel tracking.
  | "video_3s_view" | "video_25_percent" | "video_50_percent"
  | "video_75_percent" | "video_swiped_forward" | "video_swiped_back"
  | "video_replayed" | "video_reaction_added" | "video_reaction_removed"
  | "comment_submitted" | "artist_avatar_clicked" | "artist_dropdown_open"
  | "artist_gallery_view" | "artist_video_interaction" | "artist_booking_selected"
  | "artist_changed_during_booking" | "artist_whatsapp_continue" | "consultation_acknowledgement_viewed"
  | "carousel_shown" | "carousel_image_impression" | "carousel_manual_swipe"
  | "carousel_auto_advance" | "carousel_completed" | "carousel_swipe_up_continue"
  | "carousel_swipe_back" | "carousel_image_clicked" | "carousel_artist_clicked"
  // Feed sound session. The prompt impression is deduplicated at the call
  // site, so these describe real transitions rather than renders.
  | "sound_activation_prompt_shown" | "sound_enabled" | "sound_disabled" | "sound_playback_blocked";

const VISITOR_KEY = "bpt_visitor_id";
const SESSION_KEY = "bpt_session";
const SESSION_IDLE_MS = 30 * 60 * 1000;

function uuid() { return crypto.randomUUID(); }
function storage(kind: "localStorage" | "sessionStorage") { try { return window[kind]; } catch { return null; } }

function identity() {
  const local = storage("localStorage"); const session = storage("sessionStorage"); const now = Date.now();
  let visitorId = local?.getItem(VISITOR_KEY); if (!visitorId) { visitorId = uuid(); local?.setItem(VISITOR_KEY, visitorId); }
  let record: { id: string; lastSeen: number; landingPath: string } | null = null;
  try { const saved = session?.getItem(SESSION_KEY); record = saved ? JSON.parse(saved) : null; } catch { record = null; }
  if (!record || !record.id || now - record.lastSeen > SESSION_IDLE_MS) record = { id: uuid(), lastSeen: now, landingPath: window.location.pathname };
  else record.lastSeen = now;
  session?.setItem(SESSION_KEY, JSON.stringify(record));
  return { visitorId, sessionId: record.id, landingPath: record.landingPath };
}

function attribution() {
  const params = new URLSearchParams(window.location.search); const session = storage("sessionStorage"); const key = "bpt_attribution";
  const incoming = { source: params.get("utm_source"), medium: params.get("utm_medium"), campaign: params.get("utm_campaign"), content: params.get("utm_content"), term: params.get("utm_term") };
  const hasIncoming = Object.values(incoming).some(Boolean);
  if (hasIncoming) { session?.setItem(key, JSON.stringify(incoming)); return incoming; }
  try { return JSON.parse(session?.getItem(key) ?? "{}") as Record<string, string | null>; } catch { return {}; }
}

export function getAnalyticsSessionId() { return identity().sessionId; }

/** Anonymous per-browser id. Used to key feed reactions to one visitor. */
export function getAnalyticsVisitorId() { return identity().visitorId; }

/** Campaign attribution for the current session, for server-side records. */
export function getAnalyticsAttribution() { return attribution(); }

export function trackAnalytics(eventName: AnalyticsEventName, options: { entityType?: string; entityId?: string; metadata?: Record<string, string> } = {}) {
  if (typeof window === "undefined" || !window.crypto?.randomUUID) return;
  const current = identity();
  const payload = { eventId: uuid(), visitorId: current.visitorId, sessionId: current.sessionId, eventName, pagePath: window.location.pathname, landingPath: current.landingPath, referrer: document.referrer || null, attribution: attribution(), entityType: options.entityType, entityId: options.entityId, metadata: options.metadata };
  void fetch("/.netlify/functions/track", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", keepalive: true, body: JSON.stringify(payload) }).catch(() => undefined);
}
