export type AnalyticsEventName = "page_view" | "artist_view" | "artist_gallery_open" | "book_artist_click" | "portfolio_view" | "portfolio_image_open" | "booking_start" | "booking_success" | "whatsapp_click" | "whatsapp_handoff" | "home_call_view" | "home_call_click" | "faq_open";

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

export function trackAnalytics(eventName: AnalyticsEventName, options: { entityType?: string; entityId?: string; metadata?: Record<string, string> } = {}) {
  if (typeof window === "undefined" || !window.crypto?.randomUUID) return;
  const current = identity();
  const payload = { eventId: uuid(), visitorId: current.visitorId, sessionId: current.sessionId, eventName, pagePath: window.location.pathname, landingPath: current.landingPath, referrer: document.referrer || null, attribution: attribution(), entityType: options.entityType, entityId: options.entityId, metadata: options.metadata };
  void fetch("/.netlify/functions/track", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", keepalive: true, body: JSON.stringify(payload) }).catch(() => undefined);
}
