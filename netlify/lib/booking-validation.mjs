// Validation shared by the trusted Netlify booking endpoint. Keep this server
// side: the browser's validation is only for a faster visitor experience.
export const MAX_LENGTHS = {
  full_name: 120,
  email: 254,
  phone: 32,
  location: 160,
  preferred_artist: 64,
  tattoo_idea: 4000,
  placement: 120,
  approximate_size: 120,
};

const SERVICE_TYPES = new Set(["studio", "home-call"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\-\s\d]+$/;
const ARTIST_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MARKUP_PATTERN = /<\s*\/?\s*[a-z!?][^>]*>/i;
const CONTROL_CHARACTERS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function readText(body, field, errors, required, multiline = false) {
  const value = body[field];
  if (value === undefined || value === null || value === "") {
    if (required) errors[field] = "Required";
    return null;
  }
  if (typeof value !== "string") {
    errors[field] = "Must be text";
    return null;
  }
  const cleaned = value.replace(CONTROL_CHARACTERS, "");
  const text = multiline ? cleaned.replace(/\r\n?/g, "\n").trim() : cleaned.replace(/\s+/g, " ").trim();
  if (!text) {
    if (required) errors[field] = "Required";
    return null;
  }
  if (text.length > MAX_LENGTHS[field]) {
    errors[field] = `Must be ${MAX_LENGTHS[field]} characters or fewer`;
    return null;
  }
  if (MARKUP_PATTERN.test(text)) {
    errors[field] = "HTML is not allowed";
    return null;
  }
  return text;
}

export function validateBooking(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, fields: { submission_id: "Invalid request" } };
  const body = input;
  const fields = {};
  const submission_id = typeof body.submission_id === "string" && UUID_PATTERN.test(body.submission_id) ? body.submission_id.toLowerCase() : null;
  if (!submission_id) fields.submission_id = "Invalid submission id";
  const service_type = typeof body.service_type === "string" && SERVICE_TYPES.has(body.service_type) ? body.service_type : null;
  if (!service_type) fields.service_type = "Invalid service type";
  const full_name = readText(body, "full_name", fields, true);
  const email = readText(body, "email", fields, true)?.toLowerCase() ?? null;
  if (email && !EMAIL_PATTERN.test(email)) fields.email = "Valid email required";
  const phone = readText(body, "phone", fields, true);
  if (phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (!PHONE_PATTERN.test(phone) || digits < 7 || digits > 15) fields.phone = "Valid WhatsApp / phone required";
  }
  const location = service_type === "home-call" ? readText(body, "location", fields, true) : null;
  const preferred_artist = readText(body, "preferred_artist", fields, false);
  if (preferred_artist && !ARTIST_PATTERN.test(preferred_artist)) fields.preferred_artist = "Invalid artist";
  const tattoo_idea = readText(body, "tattoo_idea", fields, true, true);
  const placement = readText(body, "placement", fields, false);
  const approximate_size = readText(body, "approximate_size", fields, false);
  const analytics_session_id = typeof body.analytics_session_id === "string" && UUID_PATTERN.test(body.analytics_session_id) ? body.analytics_session_id.toLowerCase() : null;
  if (Object.keys(fields).length || !submission_id || !service_type || !full_name || !email || !phone || !tattoo_idea) return { ok: false, fields };
  return { ok: true, lead: { submission_id, full_name, email, phone, service_type, location, preferred_artist, tattoo_idea, placement, approximate_size, analytics_session_id } };
}
