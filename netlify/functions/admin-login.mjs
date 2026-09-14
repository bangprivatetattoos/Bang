import { createSession, json, pinMatches, sameOrigin, serverConfig, sessionCookie, sourceHash } from "../lib/server-security.mjs";

const MAX_BODY_BYTES = 512;

export default async (request, context) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "admin_not_configured" });
  let body;
  try { const raw = await request.text(); if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" }); body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const source = sourceHash(context, request, config.lockoutSecret);
  const audit = (outcome) => config.client.from("admin_access_events").insert({ outcome, source_hash: source });
  const { data: lock } = await config.client.from("admin_login_lockouts").select("locked_until").eq("source_hash", source).maybeSingle();
  if (lock?.locked_until && new Date(lock.locked_until).getTime() > Date.now()) { await audit("locked"); return json(429, { error: "locked", lockedUntil: lock.locked_until }); }
  if (!/^\d{6}$/.test(pin)) return json(400, { error: "invalid_request" });
  const { data: security, error } = await config.client.from("admin_security").select("pin_hash,pin_salt,security_version").eq("singleton", true).maybeSingle();
  if (error || !security) return json(503, { error: "admin_not_configured" });
  if (!(await pinMatches(pin, security, config.pepper))) {
    const failure = await config.client.rpc("record_admin_login_failure", { p_source_hash: source });
    const info = Array.isArray(failure.data) ? failure.data[0] : null;
    await audit(info?.locked_until ? "locked" : "failure");
    return info?.locked_until ? json(429, { error: "locked", lockedUntil: info.locked_until }) : json(401, { error: "incorrect_pin", attemptsRemaining: info?.attempts_remaining ?? 0 });
  }
  await config.client.rpc("clear_admin_login_lockout", { p_source_hash: source });
  await audit("success");
  return json(200, { ok: true }, { "set-cookie": sessionCookie(createSession(security.security_version, config.sessionSecret)) });
};
