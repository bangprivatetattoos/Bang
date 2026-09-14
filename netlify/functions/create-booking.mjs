// Trusted booking endpoint. It owns both the database write and the optional
// SMTP notification, so a saved booking is never dependent on a browser
// WhatsApp click or on server credentials being exposed to the client.
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { json, sameOrigin } from "../lib/server-security.mjs";
import { validateBooking } from "../lib/booking-validation.mjs";

const MAX_BODY_BYTES = 32_000;
const ADMIN_NOTIFICATION_EMAIL = "bangprivatetattoos@gmail.com";
const ARTIST_NAMES = {
  "bang-bang": "Bang Bang", solar: "Solar", "jay-shin": "Jay Shin", "sara-kori": "Sara Kori",
  victor: "Victor", saint: "Saint", pawel: "Pawel", tee: "Tee", nemo: "Nemo", natashia: "Natashia",
};

function bookingConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "", 10);
  const secureValue = (process.env.SMTP_SECURE ?? "").trim().toLowerCase();
  const smtp = {
    host: process.env.SMTP_HOST,
    port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null,
    secure: secureValue === "true" || secureValue === "1",
    user: process.env.SMTP_USER,
    password: process.env.SMTP_APP_PASSWORD,
    fromEmail: process.env.SMTP_FROM_EMAIL,
    fromName: process.env.SMTP_FROM_NAME || "BANK PRIVATE TATTOOS",
    recipient: process.env.ADMIN_NOTIFICATION_EMAIL?.trim().toLowerCase(),
  };
  return {
    client: supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null,
    smtp,
    smtpConfigured: Boolean(
      smtp.host && smtp.port && smtp.user && smtp.password && smtp.fromEmail
      && smtp.recipient === ADMIN_NOTIFICATION_EMAIL
      && ["true", "false", "1", "0"].includes(secureValue),
    ),
  };
}

function serviceLabel(serviceType) { return serviceType === "home-call" ? "Home Call" : "Studio Appointment"; }
function artistLabel(artistId) { return artistId ? (ARTIST_NAMES[artistId] ?? artistId) : "No preference"; }
function submittedAt(value) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York", timeZoneName: "short",
  }).format(new Date(value));
}
function emailText(lead) {
  const lines = [
    "BANK PRIVATE TATTOOS",
    "NEW CONSULTATION",
    "",
    `Reference: ${lead.reference}`,
    "",
    `Name: ${lead.full_name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Service: ${serviceLabel(lead.service_type)}`,
    `Preferred Artist: ${artistLabel(lead.preferred_artist)}`,
  ];
  if (lead.location) lines.push(`Location: ${lead.location}`);
  if (lead.placement) lines.push(`Placement: ${lead.placement}`);
  if (lead.approximate_size) lines.push(`Approximate Size: ${lead.approximate_size}`);
  lines.push("", "Tattoo Idea:", lead.tattoo_idea, "", `Submitted: ${submittedAt(lead.created_at)}`);
  return lines.join("\n");
}
function errorCategory(error) {
  const code = typeof error?.code === "string" ? error.code : "unknown";
  if (/^[A-Z0-9_]{1,40}$/i.test(code) && code !== "unknown") return code;
  const responseCode = Number(error?.responseCode);
  if (Number.isInteger(responseCode) && responseCode >= 400 && responseCode <= 599) return `SMTP_${responseCode}`;
  // SMTP libraries do not always expose a stable error code. Classify their
  // message without logging it, so diagnostics remain useful and credential-safe.
  const message = [
    typeof error?.message === "string" ? error.message : "",
    typeof error === "string" ? error : "",
    String(error ?? ""),
  ].join(" ").toLowerCase();
  if (/auth|login|credential|password/.test(message)) return "SMTP_AUTH";
  if (/timed? out|timeout/.test(message)) return "SMTP_TIMEOUT";
  if (/certificate|tls|ssl/.test(message)) return "SMTP_TLS";
  if (/connect|socket|network|refused|unreachable/.test(message)) return "SMTP_CONNECTION";
  if (error?.name === "TypeError") return "SMTP_RUNTIME_TYPE";
  return "unknown";
}

async function notifyLead(client, smtp, lead) {
  // Atomically claim a booking's notification before SMTP. Replayed requests
  // see an already-claimed record and cannot send a second administrator mail.
  const claim = await client.from("booking_leads")
    .update({ notification_status: "sending", notification_attempted_at: new Date().toISOString(), notification_error_code: null })
    .eq("id", lead.id)
    .eq("notification_status", "pending")
    .select("id")
    .maybeSingle();
  if (claim.error) {
    console.error("booking notification claim failed", lead.reference, claim.error.code ?? "unknown");
    return;
  }
  if (!claim.data) return;
  try {
    console.info("booking notification transport initializing", lead.reference);
    const transport = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.password } });
    const subject = `New Tattoo Consultation — ${lead.reference}${lead.preferred_artist ? ` — ${artistLabel(lead.preferred_artist)}` : ""}`;
    console.info("booking notification send attempted", lead.reference);
    await transport.sendMail({ from: { name: smtp.fromName, address: smtp.fromEmail }, to: smtp.recipient, subject, text: emailText(lead) });
    const result = await client.from("booking_leads").update({ notification_status: "sent", notification_sent_at: new Date().toISOString(), notification_error_code: null }).eq("id", lead.id).eq("notification_status", "sending");
    if (result.error) console.error("booking notification sent but status update failed", lead.reference, result.error.code ?? "unknown");
    else console.info("booking notification sent", lead.reference);
  } catch (error) {
    const category = errorCategory(error);
    const result = await client.from("booking_leads").update({ notification_status: "failed", notification_error_code: category }).eq("id", lead.id).eq("notification_status", "sending");
    if (result.error) console.error("booking notification failure could not be recorded", lead.reference, result.error.code ?? "unknown");
    console.error("booking notification failed", lead.reference, category);
  }
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });
  let body;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });
    body = JSON.parse(raw);
  } catch { return json(400, { error: "invalid_json" }); }
  const validated = validateBooking(body);
  if (!validated.ok) return json(400, { error: "invalid_request", fields: validated.fields });
  const config = bookingConfig();
  if (!config.client) {
    console.error("create-booking: Supabase server credentials are not configured");
    return json(503, { error: "server_error" });
  }
  let lead = validated.lead;
  let storedLead;
  let inserted = false;
  try {
    // An unavailable analytics session is non-fatal, exactly as it was in the
    // Edge Function. A valid consultation must never fail because analytics is unavailable.
    if (lead.analytics_session_id) {
      const session = await config.client.from("analytics_sessions").select("id").eq("id", lead.analytics_session_id).maybeSingle();
      if (session.error || !session.data) lead = { ...lead, analytics_session_id: null };
    }
    const insert = await config.client.from("booking_leads").insert(lead)
      .select("id,reference,submission_id,full_name,email,phone,service_type,location,preferred_artist,tattoo_idea,placement,approximate_size,created_at,notification_status").maybeSingle();
    if (insert.error && insert.error.code !== "23505") {
      console.error("create-booking: insert failed", insert.error.code ?? "unknown");
      return json(500, { error: "server_error" });
    }
    storedLead = insert.data;
    inserted = Boolean(storedLead);
    if (!storedLead) {
      const existing = await config.client.from("booking_leads")
        .select("id,reference,submission_id,full_name,email,phone,service_type,location,preferred_artist,tattoo_idea,placement,approximate_size,created_at,notification_status")
        .eq("submission_id", lead.submission_id).eq("email", lead.email).maybeSingle();
      if (existing.error || !existing.data) {
        console.error("create-booking: duplicate lookup failed", existing.error?.code ?? "unknown");
        return json(500, { error: "server_error" });
      }
      storedLead = existing.data;
    }
  } catch (error) {
    console.error("create-booking: unexpected database error", error instanceof Error ? error.name : "unknown");
    return json(500, { error: "server_error" });
  }
  if (!config.smtpConfigured) {
    console.error("booking notification skipped: SMTP configuration is incomplete", storedLead.reference);
    await config.client.from("booking_leads").update({ notification_status: "failed", notification_attempted_at: new Date().toISOString(), notification_error_code: "SMTP_CONFIG" }).eq("id", storedLead.id).eq("notification_status", "pending");
  } else if (storedLead.notification_status === "pending") {
    await notifyLead(config.client, config.smtp, storedLead);
  }
  return json(inserted ? 201 : 200, { reference: storedLead.reference });
};
