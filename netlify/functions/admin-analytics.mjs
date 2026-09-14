import { json, sanitizeText, serverConfig, verifyAdminSession } from "../lib/server-security.mjs";

const VALID_RANGES = new Set(["today", "yesterday", "7d", "30d", "custom"]);
const PAGE_SIZES = new Set([5, 25, 50, 100]);

function rangeFor(filters) {
  const now = new Date(); const start = new Date(now);
  if (filters.range === "yesterday") { start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 1); const end = new Date(start); end.setDate(end.getDate() + 1); return { start, end }; }
  if (filters.range === "7d") start.setDate(start.getDate() - 7);
  else if (filters.range === "30d") start.setDate(start.getDate() - 30);
  else if (filters.range === "today") start.setHours(0, 0, 0, 0);
  else if (filters.range === "custom") { const parsed = new Date(filters.start); const parsedEnd = new Date(filters.end); if (!Number.isNaN(parsed.valueOf()) && !Number.isNaN(parsedEnd.valueOf()) && parsedEnd >= parsed && (parsedEnd - parsed) <= 92 * 86400000) return { start: parsed, end: new Date(parsedEnd.getTime() + 86400000) }; }
  return { start, end: now };
}

function normalizedSource(session) {
  const source = (session.utm_source ?? "").toLowerCase(); const referrer = (session.referrer ?? "").toLowerCase();
  if (source === "facebook" || source === "fb" || source === "instagram" || source === "google") return source === "fb" ? "Facebook" : source[0].toUpperCase() + source.slice(1);
  if (!source && /facebook\.com/.test(referrer)) return "Facebook";
  if (!source && /instagram\.com/.test(referrer)) return "Instagram";
  if (!source && /google\./.test(referrer)) return "Google";
  if (!source && !referrer) return "Direct";
  return source ? "Other" : "Referral";
}

function labelArtist(event) { return event.metadata?.artist_name || event.entity_id?.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Unknown artist"; }
const key = (value) => value || "Unknown";
const count = (items, get) => [...items.reduce((map, item) => { const itemKey = get(item); map.set(itemKey, (map.get(itemKey) ?? 0) + 1); return map; }, new Map()).entries()];

async function allRows(query) {
  const rows = []; const pageSize = 1000;
  for (let from = 0; ; from += pageSize) { const { data, error } = await query.range(from, from + pageSize - 1); if (error) throw error; rows.push(...(data ?? [])); if ((data ?? []).length < pageSize) return rows; }
}

async function loadEvents(client, sessionIds) {
  const all = [];
  for (let index = 0; index < sessionIds.length; index += 150) { const slice = sessionIds.slice(index, index + 150); if (!slice.length) continue; const { data, error } = await client.from("analytics_events").select("id,session_id,event_name,page_path,entity_type,entity_id,metadata,created_at").in("session_id", slice); if (error) throw error; all.push(...(data ?? [])); }
  return all;
}

async function loadBookings(client, sessionIds) {
  const all = [];
  for (let index = 0; index < sessionIds.length; index += 150) { const slice = sessionIds.slice(index, index + 150); if (!slice.length) continue; const { data, error } = await client.from("booking_leads").select("analytics_session_id,service_type,preferred_artist,created_at").in("analytics_session_id", slice); if (error) throw error; all.push(...(data ?? [])); }
  return all;
}

function emptyDashboard() {
  return { overview: [{ label: "Visitors", value: 0 }, { label: "Unique visitors", value: 0 }, { label: "Sessions", value: 0 }, { label: "Booking starts", value: 0 }, { label: "Booking submissions", value: 0 }, { label: "WhatsApp handoffs", value: 0 }, { label: "Conversion rate", value: 0, format: "percent" }, { label: "Home Call interest", value: 0 }], traffic: [], sources: [], campaigns: [], locations: [], states: [], funnel: [{ label: "Site visits", value: 0 }, { label: "Artist / work engagements", value: 0 }, { label: "Booking starts", value: 0 }, { label: "Booking submissions", value: 0 }, { label: "WhatsApp handoffs", value: 0 }], artists: [], portfolio: [], devices: [], platforms: [], content: [], homeCall: { views: 0, clicks: 0, starts: 0, leads: 0, states: [] }, booking: { starts: 0, submissions: 0, abandoned: 0, studio: 0, homeCall: 0, artistSpecific: 0, noPreference: 0 }, activity: [], filterOptions: { campaigns: [], countries: [], states: [], artists: [] } };
}

async function dashboard(client, filters, page, pageSize) {
  const period = rangeFor(filters); let query = client.from("analytics_sessions").select("id,visitor_id,started_at,last_seen_at,landing_path,referrer,utm_source,utm_medium,utm_campaign,country,region,city,device_type,operating_system,browser").gte("started_at", period.start.toISOString()).lt("started_at", period.end.toISOString()).order("started_at", { ascending: false });
  if (filters.country) query = query.eq("country", filters.country); if (filters.state) query = query.eq("region", filters.state); if (filters.device) query = query.eq("device_type", filters.device.toLowerCase()); if (filters.campaign) query = query.eq("utm_campaign", filters.campaign);
  let sessions = await allRows(query);
  if (filters.source) sessions = sessions.filter((session) => normalizedSource(session) === filters.source);
  const ids = sessions.map((session) => session.id); const [events, bookings] = await Promise.all([loadEvents(client, ids), loadBookings(client, ids)]);
  const filterArtist = filters.artist; const filterService = filters.service;
  const matchingEvents = filterArtist ? events.filter((event) => labelArtist(event) === filterArtist || event.entity_id === filterArtist) : events;
  const matchingBookings = filterService ? bookings.filter((booking) => booking.service_type === filterService) : bookings;
  if (filterService) sessions = sessions.filter((session) => matchingEvents.some((event) => event.session_id === session.id) || matchingBookings.some((booking) => booking.analytics_session_id === session.id));
  const activeIds = new Set(sessions.map((session) => session.id)); const activeEvents = matchingEvents.filter((event) => activeIds.has(event.session_id)); const activeBookings = matchingBookings.filter((booking) => activeIds.has(booking.analytics_session_id));
  const unique = new Set(sessions.map((session) => session.visitor_id)).size; const starts = new Set(activeEvents.filter((event) => event.event_name === "booking_start").map((event) => event.session_id)).size; const submissions = new Set(activeBookings.map((booking) => booking.analytics_session_id)).size || new Set(activeEvents.filter((event) => event.event_name === "booking_success").map((event) => event.session_id)).size; const handoffs = new Set(activeEvents.filter((event) => ["whatsapp_click", "whatsapp_handoff"].includes(event.event_name)).map((event) => event.session_id)).size; const home = new Set(activeEvents.filter((event) => event.event_name === "home_call_click" || event.event_name === "home_call_view").map((event) => event.session_id)).size;
  const sourceColors = ["#d7cec1", "#8f8a83", "#706c67", "#4e4b47", "#383633", "#292725"];
  const sources = count(sessions, normalizedSource).map(([source, visitors], index) => ({ source, visitors, sessions: visitors, leads: activeBookings.filter((booking) => normalizedSource(sessions.find((session) => session.id === booking.analytics_session_id) ?? {}) === source).length, color: sourceColors[index % sourceColors.length] })).sort((a, b) => b.visitors - a.visitors);
  const stateEntries = count(sessions.filter((session) => session.country === "United States"), (session) => key(session.region)).map(([state, visitors]) => ({ state, visitors, bookings: activeBookings.filter((booking) => sessions.find((session) => session.id === booking.analytics_session_id)?.region === state).length })).sort((a, b) => b.visitors - a.visitors);
  const locations = count(sessions, (session) => `${key(session.country)}|${key(session.region)}|${key(session.city)}`).map(([joined, visitors], index) => { const [country, state, city] = joined.split("|"); return { id: `location-${index}`, country, state, city, visitors, sessions: visitors, bookings: activeBookings.filter((booking) => { const found = sessions.find((session) => session.id === booking.analytics_session_id); return found?.country === country && key(found?.region) === state && key(found?.city) === city; }).length }; }).sort((a, b) => b.visitors - a.visitors);
  const campaigns = count(sessions.filter((session) => session.utm_campaign), (session) => `${session.utm_campaign}|${normalizedSource(session)}`).map(([joined, visitors], index) => { const [campaign, source] = joined.split("|"); const campaignSessions = sessions.filter((session) => session.utm_campaign === campaign && normalizedSource(session) === source); const campaignIds = new Set(campaignSessions.map((session) => session.id)); const campaignStarts = new Set(activeEvents.filter((event) => event.event_name === "booking_start" && campaignIds.has(event.session_id)).map((event) => event.session_id)).size; const campaignLeads = activeBookings.filter((booking) => campaignIds.has(booking.analytics_session_id)).length; const campaignWhatsapp = new Set(activeEvents.filter((event) => ["whatsapp_click", "whatsapp_handoff"].includes(event.event_name) && campaignIds.has(event.session_id)).map((event) => event.session_id)).size; return { id: `campaign-${index}`, campaign, source, visitors, starts: campaignStarts, leads: campaignLeads, whatsapp: campaignWhatsapp }; }).sort((a, b) => b.visitors - a.visitors);
  const artistNames = [...new Set(activeEvents.filter((event) => ["artist_view", "artist_gallery_open", "book_artist_click"].includes(event.event_name)).map(labelArtist))];
  const artists = artistNames.map((artist) => { const artistEvents = activeEvents.filter((event) => labelArtist(event) === artist); const sessionIds = new Set(artistEvents.map((event) => event.session_id)); return { artist, profileViews: new Set(artistEvents.filter((event) => event.event_name === "artist_view").map((event) => event.session_id)).size, galleryOpens: new Set(artistEvents.filter((event) => event.event_name === "artist_gallery_open").map((event) => event.session_id)).size, bookClicks: new Set(artistEvents.filter((event) => event.event_name === "book_artist_click").map((event) => event.session_id)).size, starts: new Set(activeEvents.filter((event) => event.event_name === "booking_start" && sessionIds.has(event.session_id)).map((event) => event.session_id)).size, leads: activeBookings.filter((booking) => sessionIds.has(booking.analytics_session_id)).length }; }).sort((a, b) => b.profileViews - a.profileViews);
  const portfolioImages = new Map();
  for (const event of activeEvents.filter((item) => item.event_name === "portfolio_image_open")) {
    const image = event.entity_id ?? "Unlabelled work";
    const item = portfolioImages.get(image) ?? { image, artist: event.metadata?.artist_name ?? "Unassigned", views: 0, sessionIds: new Set() };
    item.views += 1;
    item.sessionIds.add(event.session_id);
    portfolioImages.set(image, item);
  }
  const portfolio = [...portfolioImages.values()].map(({ sessionIds, ...item }) => ({ ...item, clicks: sessionIds.size, artistVisits: new Set(activeEvents.filter((event) => event.event_name === "artist_view" && sessionIds.has(event.session_id) && labelArtist(event) === item.artist).map((event) => event.session_id)).size, bookings: activeBookings.filter((booking) => sessionIds.has(booking.analytics_session_id)).length })).sort((a, b) => b.views - a.views);
  const devices = count(sessions, (session) => key(session.device_type)).map(([device, visitors], index) => ({ device: device[0].toUpperCase() + device.slice(1), visitors, conversions: activeBookings.filter((booking) => sessions.find((session) => session.id === booking.analytics_session_id)?.device_type === device).length, color: ["#e7dfd3", "#77716a", "#48443f", "#292725"][index % 4] }));
  const platforms = count(sessions, (session) => key(session.operating_system)).map(([name, visitors]) => ({ name, visitors })).sort((a, b) => b.visitors - a.visitors);
  const trafficBuckets = new Map();
  const multiDay = filters.range !== "today" && filters.range !== "yesterday";
  // ISO prefixes sort chronologically; sessions arrive newest first, so buckets are sorted before charting.
  const bucketKey = (date) => date.toISOString().slice(0, multiDay ? 10 : 13);
  const bucketLabel = (bucket) => multiDay ? bucket.slice(5, 10) : `${bucket.slice(11, 13)}:00`;
  for (const session of sessions) {
    const bucket = bucketKey(new Date(session.started_at));
    const item = trafficBuckets.get(bucket) ?? { bucket, sessions: 0, visitorIds: new Set() };
    item.sessions += 1;
    item.visitorIds.add(session.visitor_id);
    trafficBuckets.set(bucket, item);
  }
  const traffic = [...trafficBuckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).map((item) => ({
    label: bucketLabel(item.bucket),
    visitors: item.visitorIds.size,
    sessions: item.sessions,
    bookings: activeBookings.filter((booking) => {
      const bookingSession = sessions.find((session) => session.id === booking.analytics_session_id);
      return bookingSession && bucketKey(new Date(bookingSession.started_at)) === item.bucket;
    }).length,
  }));
  const pageViews = activeEvents.filter((event) => event.event_name === "page_view");
  const lastPageViews = new Map();
  for (const event of pageViews) { const last = lastPageViews.get(event.session_id); if (!last || new Date(event.created_at) > new Date(last.created_at)) lastPageViews.set(event.session_id, event); }
  const exits = new Map(count([...lastPageViews.values()], (event) => event.page_path));
  const content = count(pageViews, (event) => event.page_path).map(([pagePath, views]) => ({ page: pagePath, views, starts: new Set(activeEvents.filter((event) => event.event_name === "booking_start" && event.page_path === pagePath).map((event) => event.session_id)).size, exitRate: Math.round((exits.get(pagePath) ?? 0) / views * 100) })).sort((a, b) => b.views - a.views);
  const homeCallSessions = new Set(activeEvents.filter((event) => event.event_name === "home_call_view" || event.event_name === "home_call_click").map((event) => event.session_id)); const homeBookings = activeBookings.filter((booking) => booking.service_type === "home-call");
  const homeCallStates = count(sessions.filter((session) => homeCallSessions.has(session.id) && session.country === "United States"), (session) => key(session.region)).map(([state, visitors]) => ({ state, visitors, bookings: homeBookings.filter((booking) => key(sessions.find((session) => session.id === booking.analytics_session_id)?.region) === state).length })).sort((a, b) => b.visitors - a.visitors);
  const activityEvents = [...activeEvents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); const total = activityEvents.length; const activity = activityEvents.slice((page - 1) * pageSize, page * pageSize).map((event) => { const session = sessions.find((item) => item.id === event.session_id) ?? {}; return { id: event.id, dateTime: event.created_at, source: normalizedSource(session), campaign: session.utm_campaign ?? "—", country: session.country ?? "Unknown", state: session.region ?? "Unknown", device: session.device_type ?? "Other", artist: labelArtist(event), event: event.event_name.replace(/_/g, " "), converted: activeBookings.some((booking) => booking.analytics_session_id === event.session_id) }; });
  return { overview: [{ label: "Visitors", value: unique }, { label: "Unique visitors", value: unique }, { label: "Sessions", value: sessions.length }, { label: "Booking starts", value: starts }, { label: "Booking submissions", value: submissions }, { label: "WhatsApp handoffs", value: handoffs }, { label: "Conversion rate", value: unique ? Number((submissions / unique * 100).toFixed(1)) : 0, format: "percent" }, { label: "Home Call interest", value: home }], traffic, sources, campaigns, locations, states: stateEntries, funnel: [{ label: "Site visits", value: unique }, { label: "Artist / work engagements", value: new Set(activeEvents.filter((event) => ["artist_view", "portfolio_view", "portfolio_image_open"].includes(event.event_name)).map((event) => event.session_id)).size }, { label: "Booking starts", value: starts }, { label: "Booking submissions", value: submissions }, { label: "WhatsApp handoffs", value: handoffs }], artists, portfolio, devices, platforms, content, homeCall: { views: new Set(activeEvents.filter((event) => event.event_name === "home_call_view").map((event) => event.session_id)).size, clicks: new Set(activeEvents.filter((event) => event.event_name === "home_call_click").map((event) => event.session_id)).size, starts: new Set(activeEvents.filter((event) => event.event_name === "booking_start" && homeCallSessions.has(event.session_id)).map((event) => event.session_id)).size, leads: homeBookings.length, states: homeCallStates }, booking: { starts, submissions, abandoned: Math.max(0, starts - submissions), studio: activeBookings.filter((booking) => booking.service_type === "studio").length, homeCall: homeBookings.length, artistSpecific: activeBookings.filter((booking) => booking.preferred_artist).length, noPreference: activeBookings.filter((booking) => !booking.preferred_artist).length }, activity, activityPagination: { page, pageSize, total }, filterOptions: { campaigns: [...new Set(sessions.map((session) => session.utm_campaign).filter(Boolean))], countries: [...new Set(sessions.map((session) => session.country).filter(Boolean))], states: [...new Set(sessions.map((session) => session.region).filter(Boolean))], artists: [...new Set(artists.map((artist) => artist.artist))] } };
}

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "method_not_allowed" });
  const config = serverConfig(); const session = await verifyAdminSession(request, config);
  if (!session.ok) return json(session.reason === "not_configured" ? 503 : 401, { error: session.reason === "not_configured" ? "analytics_not_configured" : "unauthorized" });
  const url = new URL(request.url); const range = url.searchParams.get("range") ?? "today"; const page = Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1); const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? 25); const pageSize = PAGE_SIZES.has(pageSizeRaw) ? pageSizeRaw : 25;
  const filters = { range: VALID_RANGES.has(range) ? range : "today", start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "", source: sanitizeText(url.searchParams.get("source"), 64), campaign: sanitizeText(url.searchParams.get("campaign"), 300), country: sanitizeText(url.searchParams.get("country"), 100), state: sanitizeText(url.searchParams.get("state"), 100), device: sanitizeText(url.searchParams.get("device"), 20), artist: sanitizeText(url.searchParams.get("artist"), 160), service: ["studio", "home-call"].includes(url.searchParams.get("service")) ? url.searchParams.get("service") : null };
  try { return json(200, { configured: true, data: await dashboard(config.client, filters, page, pageSize) }); } catch (error) { console.error("admin-analytics", error instanceof Error ? error.message : "query_failed"); return json(500, { error: "server_error" }); }
};
