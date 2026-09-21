import { createHmac } from "node:crypto";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Rate-limit key for a feed endpoint.
 *
 * Feed writes get their own namespace so they cannot be starved by — or starve
 * — the analytics collector, which shares the same per-minute counter table.
 */
export function feedSourceHash(namespace, context, request, secret) {
  const ip = context?.ip ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return createHmac("sha256", secret).update(`${namespace}\n${ip}\n${userAgent}`).digest("hex");
}

/** Strips control characters and collapses runs of whitespace. */
export function cleanText(value, max) {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const stripped = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return stripped ? stripped.slice(0, max) : null;
}

/** Preserves paragraph breaks but removes other control characters. */
export function cleanMultiline(value, max) {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const stripped = value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return stripped ? stripped.slice(0, max) : null;
}

export function validContentId(value) {
  return typeof value === "string" && value.length <= 120 && CONTENT_ID_PATTERN.test(value);
}

/**
 * Classifies a visitor's optional follow-up contact detail.
 *
 * The field is a single "phone or email" input in the UI, so the server, not
 * the browser, decides which it is and whether it is usable.
 */
export function classifyContact(value) {
  const cleaned = cleanText(value, 254);
  if (!cleaned) return { kind: null, value: null, ok: true };
  if (EMAIL_PATTERN.test(cleaned)) return { kind: "email", value: cleaned.toLowerCase(), ok: true };
  const digits = cleaned.replace(/\D/g, "");
  if (/^[+()\-.\s\d]+$/.test(cleaned) && digits.length >= 7 && digits.length <= 15) {
    return { kind: "phone", value: cleaned, ok: true };
  }
  return { kind: null, value: null, ok: false };
}

/** Reads and size-guards a JSON request body. */
export async function readJson(request, maxBytes) {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return { error: "payload_too_large", status: 413 };
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > maxBytes) return { error: "payload_too_large", status: 413 };
    return { body: JSON.parse(raw) };
  } catch {
    return { error: "invalid_json", status: 400 };
  }
}
