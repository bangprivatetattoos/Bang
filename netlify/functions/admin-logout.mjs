import { clearSessionCookie, json, sameOrigin, serverConfig, sourceHash, verifyAdminSession } from "../lib/server-security.mjs";

export default async (request, context) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = serverConfig();
  if (config.configured && config.client) {
    const session = await verifyAdminSession(request, config);
    if (session.ok) await config.client.from("admin_access_events").insert({ outcome: "logout", source_hash: sourceHash(context, request, config.lockoutSecret) });
  }
  return json(200, { ok: true }, { "set-cookie": clearSessionCookie() });
};
