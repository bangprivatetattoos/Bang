import { adminSourceHash, createSession, json, pinMatches, sameOrigin, serverConfig, sessionCookie } from "../lib/server-security.mjs";

const MAX_BODY_BYTES = 512;

export default async (request, context) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "admin_not_configured" });
  let body;
  try { const raw = await request.text(); if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" }); body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const pin = typeof body?.pin === "string" ? body.pin : "";
  if (!/^\d{6}$/.test(pin)) return json(400, { error: "invalid_request" });
  const source = adminSourceHash(context, config.lockoutSecret);
  const audit = (outcome) => config.client.from("admin_access_events").insert({ outcome, source_hash: source });
  const { data: security, error } = await config.client.from("admin_security").select("pin_hash,pin_salt,security_version").eq("singleton", true).maybeSingle();
  if (error || !security) return json(503, { error: "admin_not_configured" });
  // The attempt is counted atomically before the PIN is checked, so parallel requests cannot exceed five guesses per lock window.
  const reservation = await config.client.rpc("reserve_admin_login_attempt", { p_source_hash: source });
  const attempt = Array.isArray(reservation.data) ? reservation.data[0] : null;
  if (reservation.error || !attempt) return json(503, { error: "server_error" });
  if (!attempt.allowed) { await audit("locked"); return json(429, { error: "locked", lockedUntil: attempt.locked_until }); }
  if (!(await pinMatches(pin, security, config.pepper))) {
    await audit(attempt.locked_until ? "locked" : "failure");
    return attempt.locked_until ? json(429, { error: "locked", lockedUntil: attempt.locked_until }) : json(401, { error: "incorrect_pin", attemptsRemaining: attempt.attempts_remaining });
  }
  await config.client.rpc("clear_admin_login_lockout", { p_source_hash: source });
  await audit("success");
  return json(200, { ok: true }, { "set-cookie": sessionCookie(createSession(security.security_version, config.sessionSecret)) });
};
