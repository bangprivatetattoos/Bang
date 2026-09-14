import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "bpt_admin";
const SESSION_SECONDS = 60 * 60;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function serverConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pepper = process.env.ADMIN_PIN_PEPPER;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const lockoutSecret = process.env.ADMIN_LOCKOUT_SECRET;
  return {
    configured: Boolean(url && key && pepper && sessionSecret && lockoutSecret),
    client: url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null,
    pepper, sessionSecret, lockoutSecret,
  };
}

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
}

export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export function sourceHash(context, request, secret) {
  const ip = context.ip ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return createHmac("sha256", secret).update(`${ip}\n${userAgent}`).digest("hex");
}

export async function hashPin(pin, salt, pepper) {
  const key = await scrypt(`${pin}:${pepper}`, salt, 64, SCRYPT_OPTIONS);
  return Buffer.from(key).toString("hex");
}

export async function pinMatches(pin, security, pepper) {
  const calculated = await hashPin(pin, security.pin_salt, pepper);
  const a = Buffer.from(calculated, "hex"); const b = Buffer.from(security.pin_hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function encode(value) { return Buffer.from(value).toString("base64url"); }
function decode(value) { return Buffer.from(value, "base64url").toString("utf8"); }

export function createSession(version, secret) {
  const payload = encode(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS, version, nonce: randomUUID() }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() { return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`; }

function readCookie(request, name) {
  const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function verifyAdminSession(request, config) {
  if (!config.configured || !config.client) return { ok: false, reason: "not_configured" };
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return { ok: false, reason: "unauthorized" };
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return { ok: false, reason: "unauthorized" };
  const expected = createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return { ok: false, reason: "unauthorized" };
  try {
    const decoded = JSON.parse(decode(payload));
    if (!decoded.exp || decoded.exp <= Math.floor(Date.now() / 1000) || typeof decoded.version !== "string") return { ok: false, reason: "expired" };
    const { data, error } = await config.client.from("admin_security").select("security_version").eq("singleton", true).maybeSingle();
    if (error || !data || data.security_version !== decoded.version) return { ok: false, reason: "unauthorized" };
    return { ok: true, expiresAt: decoded.exp * 1000 };
  } catch { return { ok: false, reason: "unauthorized" }; }
}

export function sanitizeText(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

export function classifyDevice(userAgent = "") {
  const agent = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk/.test(agent)) return "tablet";
  if (/mobi|android|iphone|ipod/.test(agent)) return "mobile";
  return /windows|macintosh|linux|cros/.test(agent) ? "desktop" : "other";
}

export function classifyPlatform(userAgent = "") {
  const agent = userAgent.toLowerCase();
  const operatingSystem = /iphone|ipad|ipod/.test(agent) ? "iOS" : /android/.test(agent) ? "Android" : /windows/.test(agent) ? "Windows" : /mac os|macintosh/.test(agent) ? "macOS" : /linux/.test(agent) ? "Linux" : "Other";
  const browser = /edg\//.test(agent) ? "Edge" : /firefox\//.test(agent) ? "Firefox" : /chrome\//.test(agent) ? "Chrome" : /safari\//.test(agent) ? "Safari" : "Other";
  return { operatingSystem, browser };
}
