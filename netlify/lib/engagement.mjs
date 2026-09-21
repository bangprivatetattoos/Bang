// Shared engagement helpers: admin notifications and the email outbox.
//
// Every actionable business event (a comment, an enquiry, a booking intent)
// funnels through `recordAdminAlert`. It creates at most one notification and
// at most one queued email per event, keyed by a stable dedupe key derived
// from the entity's own id — so a retried request, or a function that runs
// twice, cannot produce a second alert or a second email.
//
// Nothing in here is allowed to fail the caller. A notification or mail
// problem is logged and swallowed: a visitor's comment must never be lost
// because the studio's alerting had a bad minute.

const ADMIN_NOTIFICATION_EMAIL = "bangprivatetattoos@gmail.com";

/** Trims and hard-caps a value destined for a notification field. */
function clamp(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Creates the admin notification and queues its email.
 *
 * @param client        service-role Supabase client
 * @param alert.type    'comment' | 'inquiry' | 'booking_intent' | 'system'
 * @param alert.dedupeKey stable per business event, e.g. `comment:<uuid>`
 */
export async function recordAdminAlert(client, alert) {
  const {
    type, dedupeKey, title, summary, entityType, entityId, contentId,
    emailSubject, emailBody,
  } = alert;

  let notificationId = null;

  try {
    const inserted = await client
      .from("admin_notifications")
      .insert({
        type,
        dedupe_key: dedupeKey,
        title: clamp(title, 200) ?? type,
        summary: clamp(summary, 500),
        entity_type: entityType,
        entity_id: entityId ?? null,
        content_id: clamp(contentId, 120),
      })
      .select("id")
      .maybeSingle();

    if (inserted.error) {
      // 23505 is the dedupe key doing its job on a replayed request.
      if (inserted.error.code !== "23505") {
        console.error("admin notification insert failed", type, inserted.error.code ?? "unknown");
        return { notificationId: null };
      }
      const existing = await client
        .from("admin_notifications").select("id").eq("dedupe_key", dedupeKey).maybeSingle();
      notificationId = existing.data?.id ?? null;
    } else {
      notificationId = inserted.data?.id ?? null;
    }
  } catch (error) {
    console.error("admin notification failed", type, error instanceof Error ? error.name : "unknown");
    return { notificationId: null };
  }

  if (emailSubject && emailBody) {
    try {
      const queued = await client
        .from("admin_email_outbox")
        .insert({
          notification_id: notificationId,
          dedupe_key: dedupeKey,
          subject: emailSubject.slice(0, 300),
          body: emailBody,
        });
      if (queued.error && queued.error.code !== "23505") {
        console.error("admin email queue failed", type, queued.error.code ?? "unknown");
      }
    } catch (error) {
      console.error("admin email queue failed", type, error instanceof Error ? error.name : "unknown");
    }
  }

  return { notificationId };
}

/** Formats a timestamp the way the existing booking notifications do. */
export function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York", timeZoneName: "short",
  }).format(new Date(value));
}

/** Plain-text administrator email for a new public comment. */
export function commentEmail({ displayName, comment, contentId, createdAt }) {
  return {
    subject: "BANG PRIVATE TATTOOS — New Comment",
    body: [
      "BANG PRIVATE TATTOOS",
      "NEW COMMENT",
      "",
      `Display name: ${displayName ?? "Anonymous"}`,
      "",
      "Comment:",
      `"${comment}"`,
      "",
      `Content: ${contentId}`,
      `Timestamp: ${formatTimestamp(createdAt)}`,
      "",
      "Open the BANG dashboard to review, react, reply or moderate.",
      "",
      "Ordinary comments carry no customer phone number or email address.",
    ].join("\n"),
  };
}

/** Plain-text administrator email for a private enquiry. */
export function inquiryEmail({ displayName, contactKind, contactValue, message, contentId, artistId, createdAt }) {
  const lines = [
    "BANG PRIVATE TATTOOS",
    "NEW ENQUIRY",
    "",
    `Name: ${displayName ?? "Not given"}`,
  ];
  // Enquiry contact detail is given deliberately for follow-up, so it belongs
  // in this private administrator mail — and nowhere public.
  if (contactValue) lines.push(`${contactKind === "phone" ? "Phone" : "Email"}: ${contactValue}`);
  else lines.push("Contact: Not given");
  lines.push(
    "",
    "Message:",
    message,
    "",
    `Content: ${contentId ?? "—"}`,
    `Artist: ${artistId ?? "—"}`,
    `Timestamp: ${formatTimestamp(createdAt)}`,
    "",
    "Open the BANG dashboard to review and respond.",
  );
  return { subject: "BANG PRIVATE TATTOOS — New Enquiry", body: lines.join("\n") };
}

/** Plain-text administrator email for a completed booking intent. */
export function bookingIntentEmail({ reference, artistName, location, tattooType, priceRange, createdAt }) {
  return {
    subject: `BANG PRIVATE TATTOOS — New Booking Intent — ${reference}`,
    body: [
      "BANG PRIVATE TATTOOS",
      "NEW BOOKING INTENT — WHATSAPP HANDOFF",
      "",
      `Reference: ${reference}`,
      "",
      `Artist: ${artistName}`,
      `Location: ${location}`,
      `Tattoo type: ${tattooType}`,
      `Price range: ${priceRange}`,
      "",
      `Started: ${formatTimestamp(createdAt)}`,
      "",
      "This visitor continued to WhatsApp from the video feed. No name, email or",
      "phone number was collected - they identify themselves when they send their",
      "WhatsApp message.",
    ].join("\n"),
  };
}

export { ADMIN_NOTIFICATION_EMAIL };
