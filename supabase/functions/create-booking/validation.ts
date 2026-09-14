// Server-side validation for booking requests. Never trust the browser form:
// every value is re-checked, trimmed and normalized here before it is stored.

export type ServiceType = 'studio' | 'home-call';

export interface BookingLead {
  submission_id: string;
  full_name: string;
  email: string;
  phone: string;
  service_type: ServiceType;
  location: string | null;
  preferred_artist: string | null;
  tattoo_idea: string;
  placement: string | null;
  approximate_size: string | null;
  analytics_session_id: string | null;
}

export type FieldErrors = Partial<Record<keyof BookingLead, string>>;

export type ValidationResult = { ok: true; lead: BookingLead } | { ok: false; fields: FieldErrors };

// Kept in line with the check constraints in supabase/migrations.
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

type TextField = keyof typeof MAX_LENGTHS;

const SERVICE_TYPES: string[] = ['studio', 'home-call'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\-\s\d]+$/;
const ARTIST_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MARKUP_PATTERN = /<\s*\/?\s*[a-z!?][^>]*>/i;
// Control characters except tab, line feed and carriage return.
const CONTROL_CHARACTERS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function readText(
  body: Record<string, unknown>,
  field: TextField,
  errors: FieldErrors,
  required: boolean,
  multiline = false,
): string | null {
  const value = body[field];
  if (value === undefined || value === null || value === '') {
    if (required) errors[field] = 'Required';
    return null;
  }
  if (typeof value !== 'string') {
    errors[field] = 'Must be text';
    return null;
  }

  const cleaned = value.replace(CONTROL_CHARACTERS, '');
  const text = multiline ? cleaned.replace(/\r\n?/g, '\n').trim() : cleaned.replace(/\s+/g, ' ').trim();

  if (!text) {
    if (required) errors[field] = 'Required';
    return null;
  }
  if (text.length > MAX_LENGTHS[field]) {
    errors[field] = `Must be ${MAX_LENGTHS[field]} characters or fewer`;
    return null;
  }
  if (MARKUP_PATTERN.test(text)) {
    errors[field] = 'HTML is not allowed';
    return null;
  }
  return text;
}

export function validateBooking(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, fields: { submission_id: 'Invalid request' } };
  }
  const body = input as Record<string, unknown>;
  const errors: FieldErrors = {};

  const submissionId =
    typeof body.submission_id === 'string' && UUID_PATTERN.test(body.submission_id)
      ? body.submission_id.toLowerCase()
      : null;
  if (!submissionId) errors.submission_id = 'Invalid submission id';

  const serviceType = typeof body.service_type === 'string' && SERVICE_TYPES.includes(body.service_type)
    ? (body.service_type as ServiceType)
    : null;
  if (!serviceType) errors.service_type = 'Invalid service type';

  const fullName = readText(body, 'full_name', errors, true);

  const email = readText(body, 'email', errors, true)?.toLowerCase() ?? null;
  if (email && !EMAIL_PATTERN.test(email)) errors.email = 'Valid email required';

  const phone = readText(body, 'phone', errors, true);
  if (phone) {
    const digits = phone.replace(/\D/g, '').length;
    if (!PHONE_PATTERN.test(phone) || digits < 7 || digits > 15) errors.phone = 'Valid WhatsApp / phone required';
  }

  // Location is only collected (and required) for Home Call requests.
  const location = serviceType === 'home-call' ? readText(body, 'location', errors, true) : null;

  const preferredArtist = readText(body, 'preferred_artist', errors, false);
  if (preferredArtist && !ARTIST_PATTERN.test(preferredArtist)) errors.preferred_artist = 'Invalid artist';

  const tattooIdea = readText(body, 'tattoo_idea', errors, true, true);
  const placement = readText(body, 'placement', errors, false);
  const approximateSize = readText(body, 'approximate_size', errors, false);
  const analyticsSessionId = typeof body.analytics_session_id === 'string' && UUID_PATTERN.test(body.analytics_session_id)
    ? body.analytics_session_id.toLowerCase()
    : null;

  if (Object.keys(errors).length || !submissionId || !serviceType || !fullName || !email || !phone || !tattooIdea) {
    return { ok: false, fields: errors };
  }

  return {
    ok: true,
    lead: {
      submission_id: submissionId,
      full_name: fullName,
      email,
      phone,
      service_type: serviceType,
      location,
      preferred_artist: preferredArtist,
      tattoo_idea: tattooIdea,
      placement,
      approximate_size: approximateSize,
      analytics_session_id: analyticsSessionId,
    },
  };
}
