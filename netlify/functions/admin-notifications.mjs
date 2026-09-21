// Admin notification centre API.
//
// Behind the existing admin session cookie — the same boundary the analytics
// dashboard uses. A visitor cannot read, mark or delete anything here: the
// table has no anon grant and every path below verifies the session first.
//
// Deleting a notification only ever clears the alert. The comment, enquiry or
// booking it points at is a separate record and is never touched.
import { json, sameOrigin, serverConfig, verifyAdminSession } from "../lib/server-security.mjs";
import { readJson, UUID_PATTERN } from "../lib/feed-validation.mjs";

const MAX_BODY_BYTES = 8_000;
const PAGE_SIZE = 25;
const MAX_BULK = 200;

const TYPES = new Set(["comment", "inquiry", "booking_intent", "system"]);
const ACTIONS = new Set(["mark_read", "mark_unread", "delete"]);

const toPublic = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  summary: row.summary,
  entityType: row.entity_type,
  entityId: row.entity_id,
  contentId: row.content_id,
  createdAt: row.created_at,
  readAt: row.read_at,
});

async function list(client, url) {
  const params = url.searchParams;
  const filter = params.get("filter") ?? "all";
  const order = params.get("order") === "oldest" ? true : false;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get("pageSize") ?? String(PAGE_SIZE), 10) || PAGE_SIZE));

  let query = client
    .from("admin_notifications")
    .select("id,type,title,summary,entity_type,entity_id,content_id,created_at,read_at", { count: "exact" })
    .is("deleted_at", null);

  if (filter === "unread") query = query.is("read_at", null);
  else if (TYPES.has(filter)) query = query.eq("type", filter);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: order })
    .range(from, from + pageSize - 1);

  if (error) {
    console.error("admin-notifications: list failed", error.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  // The badge is always the live unread total, independent of the filter.
  const unread = await client
    .from("admin_notifications")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .is("read_at", null);

  return json(200, {
    notifications: (data ?? []).map(toPublic),
    total: count ?? 0,
    page,
    pageSize,
    unreadCount: unread.count ?? 0,
  });
}

async function mutate(client, body) {
  const action = body?.action;
  if (!ACTIONS.has(action)) return json(400, { error: "invalid_request" });

  const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === "string" && UUID_PATTERN.test(id)) : [];
  if (ids.length === 0 || ids.length > MAX_BULK) return json(400, { error: "invalid_request" });

  const now = new Date().toISOString();
  const patch = action === "mark_read" ? { read_at: now }
    : action === "mark_unread" ? { read_at: null }
    // Soft delete: the alert leaves the dashboard, the row stays for audit,
    // and the underlying comment/enquiry/booking is untouched either way.
    : { deleted_at: now };

  const { error } = await client.from("admin_notifications").update(patch).in("id", ids);
  if (error) {
    console.error("admin-notifications: mutate failed", action, error.code ?? "unknown");
    return json(500, { error: "server_error" });
  }

  const unread = await client
    .from("admin_notifications")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .is("read_at", null);

  return json(200, { ok: true, affected: ids.length, unreadCount: unread.count ?? 0 });
}

export default async (request) => {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = serverConfig();
  if (!config.configured || !config.client) return json(503, { error: "not_configured" });

  const session = await verifyAdminSession(request, config);
  if (!session.ok) return json(401, { error: "unauthorized" });

  if (request.method === "GET") return list(config.client, new URL(request.url));

  if (request.method === "POST") {
    const parsed = await readJson(request, MAX_BODY_BYTES);
    if (parsed.error) return json(parsed.status, { error: parsed.error });
    return mutate(config.client, parsed.body);
  }

  return json(405, { error: "method_not_allowed" });
};
