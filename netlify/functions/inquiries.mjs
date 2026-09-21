// Private visitor enquiries.
//
// Separate from public comments on purpose. An enquiry is a message to the
// studio, so it may carry the contact detail the visitor chose to give — and
// it is never readable publicly: the table has no anon grant, no anon policy,
// and this endpoint has no read path at all.
import { json, sameOrigin, sanitizeText, serverConfig } from "../lib/server-security.mjs";
import { classifyContact, cleanMultiline, cleanText, feedSourceHash, readJson, UUID_PATTERN, validContentId } from "../lib/feed-validation.mjs";
import { inquiryEmail, recordAdminAlert } from "../lib/engagement.mjs";

const MAX_BODY_BYTES = 8_000;
/** Enquiry submissions allowed per visitor per minute. */
const WRITE_LIMIT = 4;
const ARTIST_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const stripMarkup = (value) => (typeof value === "string" ? value.replace(/<[^>]*>/g, " ") : value);

export default async (request, context) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });

  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "inquiries_not_configured" });
  const client = config.client;

  const parsed = await readJson(request, MAX_BODY_BYTES);
  if (parsed.error) return json(parsed.status, { error: parsed.error });
  const body = parsed.body ?? {};

  const message = cleanMultiline(stripMarkup(body.message), 4000);
  const displayName = cleanText(stripMarkup(body.displayName), 60);
  const contact = classifyContact(body.contact);
  const contentId = typeof body.contentId === "string" && validContentId(body.contentId) ? body.contentId : null;
  const artistId = typeof body.artistId === "string" && ARTIST_ID_PATTERN.test(body.artistId) && body.artistId.length <= 64
    ? body.artistId
    : null;
  const visitorId = typeof body.visitorId === "string" && UUID_PATTERN.test(body.visitorId) ? body.visitorId : null;

  const fields = {};
  if (!message) fields.message = "Please tell us what you would like to know";
  if (!contact.ok) fields.contact = "Enter a valid phone number or email address";
  if (Object.keys(fields).length) return json(400, { error: "invalid_request", fields });

  const limitKey = feedSourceHash("inquiry", context, request, config.lockoutSecret);
  const limited = await client.rpc("consume_analytics_rate_limit", { p_source_hash: limitKey, p_limit: WRITE_LIMIT });
  if (limited.error || !limited.data) return json(429, { error: "rate_limited" });

  let analyticsSessionId = typeof body.analyticsSessionId === "string" && UUID_PATTERN.test(body.analyticsSessionId) ? body.analyticsSessionId : null;
  if (analyticsSessionId) {
    const session = await client.from("analytics_sessions").select("id").eq("id", analyticsSessionId).maybeSingle();
    if (session.error || !session.data) analyticsSessionId = null;
  }

  const attribution = body.attribution ?? {};
  const inserted = await client
    .from("inquiries")
    .insert({
      content_id: contentId,
      artist_id: artistId,
      display_name: displayName,
      contact_kind: contact.kind,
      contact_value: contact.value,
      message,
      anonymous_visitor_id: visitorId,
      analytics_session_id: analyticsSessionId,
      utm_source: sanitizeText(attribution.source, 200),
      utm_medium: sanitizeText(attribution.medium, 200),
      utm_campaign: sanitizeText(attribution.campaign, 300),
    })
    .select("id,display_name,contact_kind,contact_value,message,content_id,artist_id,created_at")
    .maybeSingle();

  if (inserted.error || !inserted.data) {
    console.error("inquiries: insert failed", inserted.error?.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  const row = inserted.data;
  const mail = inquiryEmail({
    displayName: row.display_name,
    contactKind: row.contact_kind,
    contactValue: row.contact_value,
    message: row.message,
    contentId: row.content_id,
    artistId: row.artist_id,
    createdAt: row.created_at,
  });
  await recordAdminAlert(client, {
    type: "inquiry",
    dedupeKey: `inquiry:${row.id}`,
    title: "New enquiry",
    // The summary reaches the dashboard list, so it deliberately carries no
    // contact detail — that stays in the private record and the admin email.
    summary: `Enquiry received${row.content_id ? ` from ${row.content_id}` : ""}: "${row.message.slice(0, 120)}"`,
    entityType: "inquiry",
    entityId: row.id,
    contentId: row.content_id,
    emailSubject: mail.subject,
    emailBody: mail.body,
  });

  // The response deliberately carries no internal identifier.
  return json(201, { ok: true });
};
