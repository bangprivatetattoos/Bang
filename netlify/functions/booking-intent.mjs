// Anonymous booking intent from the immersive video feed.
//
// The feed's four-step booking flow asks for no name, email or phone before
// the visitor reaches WhatsApp, so it cannot write to booking_leads — every
// column there is a required personal detail. This endpoint records only the
// selections the visitor made, which is enough to attribute the conversion
// without inventing a customer identity.
//
// The consultation form, create-booking and booking_leads are untouched.
import nodemailer from "nodemailer";
import { json, sameOrigin, sanitizeText, serverConfig } from "../lib/server-security.mjs";
import { cleanText, feedSourceHash, readJson, UUID_PATTERN } from "../lib/feed-validation.mjs";
import { metaLeadEventId, sendMetaLead } from "../lib/meta-capi.mjs";
import { recordAdminAlert } from "../lib/engagement.mjs";

const MAX_BODY_BYTES = 4_000;
const ADMIN_NOTIFICATION_EMAIL = "bangprivatetattoos@gmail.com";
/** Intent submissions allowed per visitor per minute. */
const WRITE_LIMIT = 8;

const ARTIST_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function smtpConfig() {
  const port = Number.parseInt(process.env.SMTP_PORT ?? "", 10);
  const secureValue = (process.env.SMTP_SECURE ?? "").trim().toLowerCase();
  const smtp = {
    host: process.env.SMTP_HOST,
    port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null,
    secure: secureValue === "true" || secureValue === "1",
    user: process.env.SMTP_USER,
    password: process.env.SMTP_APP_PASSWORD,
    fromEmail: process.env.SMTP_FROM_EMAIL,
    fromName: process.env.SMTP_FROM_NAME || "BANG PRIVATE TATTOOS",
    recipient: process.env.ADMIN_NOTIFICATION_EMAIL?.trim().toLowerCase(),
  };
  const configured = Boolean(
    smtp.host && smtp.port && smtp.user && smtp.password && smtp.fromEmail
    && smtp.recipient === ADMIN_NOTIFICATION_EMAIL
    && ["true", "false", "1", "0"].includes(secureValue),
  );
  return { smtp, configured };
}

function submittedAt(value) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York", timeZoneName: "short",
  }).format(new Date(value));
}

function emailText(intent, artistName) {
  const lines = [
    "BANG PRIVATE TATTOOS",
    "NEW BOOKING INTENT — WHATSAPP HANDOFF",
    "",
    `Reference: ${intent.reference}`,
    "",
    `Artist: ${artistName}`,
    `Location: ${intent.location}`,
    `Tattoo type: ${intent.tattoo_type}`,
    `Price range: ${intent.price_range}`,
  ];
  if (intent.utm_source || intent.utm_campaign) {
    lines.push("", `Campaign: ${intent.utm_campaign ?? "—"} (${intent.utm_source ?? "—"}${intent.utm_medium ? ` / ${intent.utm_medium}` : ""})`);
  }
  lines.push(
    "",
    `Started: ${submittedAt(intent.created_at)}`,
    "",
    "This visitor continued to WhatsApp from the video feed. No name, email or",
    "phone number was collected - they identify themselves when they send their",
    "WhatsApp message.",
  );
  return lines.join("\n");
}

async function notify(client, smtp, intent, artistName) {
  // Claim the notification atomically before sending, so a replayed request
  // cannot produce a second administrator email.
  const claim = await client.from("booking_intents")
    .update({ notification_status: "sending", notification_attempted_at: new Date().toISOString(), notification_error_code: null })
    .eq("id", intent.id)
    .eq("notification_status", "pending")
    .select("id")
    .maybeSingle();
  if (claim.error || !claim.data) return;

  try {
    const transport = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.password } });
    await transport.sendMail({
      from: { name: smtp.fromName, address: smtp.fromEmail },
      to: smtp.recipient,
      subject: `Booking intent — ${intent.reference} — ${artistName}`,
      text: emailText(intent, artistName),
    });
    await client.from("booking_intents").update({ notification_status: "sent", notification_sent_at: new Date().toISOString() }).eq("id", intent.id).eq("notification_status", "sending");
  } catch (error) {
    await client.from("booking_intents").update({ notification_status: "failed", notification_error_code: "SMTP_SEND" }).eq("id", intent.id).eq("notification_status", "sending");
    console.error("booking intent notification failed", intent.reference, error instanceof Error ? error.name : "unknown");
  }
}

export default async (request, context) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });

  const config = serverConfig();
  if (!config.client || !config.lockoutSecret) return json(503, { error: "booking_intent_not_configured" });
  const client = config.client;

  const parsed = await readJson(request, MAX_BODY_BYTES);
  if (parsed.error) return json(parsed.status, { error: parsed.error });
  const body = parsed.body ?? {};

  const submissionId = typeof body.submissionId === "string" && UUID_PATTERN.test(body.submissionId) ? body.submissionId : null;
  const location = cleanText(body.location, 160);
  const tattooType = cleanText(body.tattooType, 120);
  const priceRange = cleanText(body.priceRange, 120);
  const artistId = typeof body.artistId === "string" && ARTIST_ID_PATTERN.test(body.artistId) && body.artistId.length <= 64 ? body.artistId : null;

  if (!submissionId || !location || !tattooType || !priceRange) return json(400, { error: "invalid_request" });

  const limitKey = feedSourceHash("booking-intent", context, request, config.lockoutSecret);
  const limited = await client.rpc("consume_analytics_rate_limit", { p_source_hash: limitKey, p_limit: WRITE_LIMIT });
  if (limited.error || !limited.data) return json(429, { error: "rate_limited" });

  let analyticsSessionId = typeof body.analyticsSessionId === "string" && UUID_PATTERN.test(body.analyticsSessionId) ? body.analyticsSessionId : null;
  if (analyticsSessionId) {
    const session = await client.from("analytics_sessions").select("id").eq("id", analyticsSessionId).maybeSingle();
    if (session.error || !session.data) analyticsSessionId = null;
  }

  const attribution = body.attribution ?? {};
  const record = {
    submission_id: submissionId,
    location,
    artist_id: artistId,
    tattoo_type: tattooType,
    price_range: priceRange,
    analytics_session_id: analyticsSessionId,
    utm_source: sanitizeText(attribution.source, 200),
    utm_medium: sanitizeText(attribution.medium, 200),
    utm_campaign: sanitizeText(attribution.campaign, 300),
  };
  const columns = "id,reference,location,artist_id,tattoo_type,price_range,utm_source,utm_medium,utm_campaign,created_at,notification_status";

  const insert = await client.from("booking_intents").insert(record).select(columns).maybeSingle();
  if (insert.error && insert.error.code !== "23505") {
    console.error("booking-intent: insert failed", insert.error.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  let stored = insert.data;
  const inserted = Boolean(stored);
  if (!stored) {
    // A retry of the same journey resolves back to its original reference, so
    // one visitor can never register two conversions.
    const existing = await client.from("booking_intents").select(columns).eq("submission_id", submissionId).maybeSingle();
    if (existing.error || !existing.data) {
      console.error("booking-intent: duplicate lookup failed", existing.error?.code ?? "unknown");
      return json(500, { error: "server_error" });
    }
    stored = existing.data;
  }

  const artistName = cleanText(body.artistName, 120) ?? (artistId ?? "No preference");
  const notifier = smtpConfig();
  if (!notifier.configured) {
    await client.from("booking_intents").update({ notification_status: "failed", notification_attempted_at: new Date().toISOString(), notification_error_code: "SMTP_CONFIG" }).eq("id", stored.id).eq("notification_status", "pending");
  } else if (stored.notification_status === "pending") {
    await notify(client, notifier.smtp, stored, artistName);
  }

  // A dashboard alert for the intent. The email itself is still sent by the
  // claim-based path above, which is already idempotent, so no outbox row is
  // queued here and the studio cannot receive the same booking mail twice.
  await recordAdminAlert(client, {
    type: "booking_intent",
    dedupeKey: `booking_intent:${stored.id}`,
    title: "New booking intent",
    summary: `${stored.location} • ${artistName} • ${stored.tattoo_type} • ${stored.price_range}`,
    entityType: "booking_intent",
    entityId: stored.id,
  });

  const metaEventId = metaLeadEventId(stored.reference);
  if (inserted) {
    try {
      await sendMetaLead({ reference: stored.reference, eventSourceUrl: request.headers.get("origin") ?? "https://bangprivatetattoos.netlify.app" });
    } catch (error) {
      // A Meta outage must not break the visitor's handoff to WhatsApp. The
      // browser Lead uses the same event id and deduplicates on delivery.
      console.error("Meta CAPI Lead failed", stored.reference, error instanceof Error ? error.message : "unknown");
    }
  }

  return json(inserted ? 201 : 200, { reference: stored.reference, meta_event_id: metaEventId });
};
