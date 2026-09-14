import { json, serverConfig, verifyAdminSession } from "../lib/server-security.mjs";

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "method_not_allowed" });
  const config = serverConfig();
  if (!config.configured) return json(200, { authenticated: false, configured: false });
  const result = await verifyAdminSession(request, config);
  return json(200, { authenticated: result.ok, configured: true, expiresAt: result.ok ? result.expiresAt : null });
};
