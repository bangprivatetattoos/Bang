// Sends queued administrator emails.
//
// Mail is never sent inline by the request that created a comment or enquiry:
// that request writes an outbox row and returns. This function drains the
// queue, so an SMTP outage can delay the studio's alert but can never fail a
// visitor's submission.
//
// Each row is claimed atomically before sending, so two overlapping runs
// cannot send the same message twice.
import nodemailer from "nodemailer";
import { json, serverConfig, verifyAdminSession } from "../lib/server-security.mjs";
import { ADMIN_NOTIFICATION_EMAIL } from "../lib/engagement.mjs";

/** How many messages one run will attempt. */
const BATCH = 20;
/** A row that has failed this many times is left alone for manual review. */
const MAX_ATTEMPTS = 5;

export const config = { schedule: "* * * * *" };

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

async function drain(client, smtp) {
  const pending = await client
    .from("admin_email_outbox")
    .select("id,subject,body,attempts")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (pending.error) {
    console.error("outbox: read failed", pending.error.code ?? "unknown");
    return { attempted: 0, sent: 0 };
  }

  let sent = 0;
  let attempted = 0;
  const transport = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.password },
  });

  for (const row of pending.data ?? []) {
    // Claim before sending. A concurrent run sees the row already claimed.
    const claim = await client
      .from("admin_email_outbox")
      .update({ status: "sending", attempts: row.attempts + 1, attempted_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) continue;

    attempted += 1;
    try {
      await transport.sendMail({
        from: { name: smtp.fromName, address: smtp.fromEmail },
        to: smtp.recipient,
        subject: row.subject,
        text: row.body,
      });
      await client.from("admin_email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error_code: null })
        .eq("id", row.id);
      sent += 1;
    } catch (error) {
      // Back to pending so a later run retries, until MAX_ATTEMPTS.
      const exhausted = row.attempts + 1 >= MAX_ATTEMPTS;
      await client.from("admin_email_outbox")
        .update({ status: exhausted ? "failed" : "pending", last_error_code: error instanceof Error ? error.name : "unknown" })
        .eq("id", row.id);
      console.error("outbox: send failed", row.id, error instanceof Error ? error.name : "unknown");
    }
  }

  return { attempted, sent };
}

export default async (request) => {
  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "not_configured" });

  // Scheduled invocations carry no session; a manual run must be an
  // authenticated administrator rather than anyone who knows the path.
  const scheduled = request.headers.get("x-nf-event") === "schedule" || request.method === "POST" && !request.headers.get("cookie");
  if (!scheduled) {
    const session = await verifyAdminSession(request, config);
    if (!session.ok) return json(401, { error: "unauthorized" });
  }

  const notifier = smtpConfig();
  if (!notifier.configured) {
    console.error("outbox: SMTP configuration is incomplete");
    return json(503, { error: "smtp_not_configured" });
  }

  const result = await drain(config.client, notifier.smtp);
  return json(200, { ok: true, ...result });
};
