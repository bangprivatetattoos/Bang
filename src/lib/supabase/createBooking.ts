export interface BookingRequest {
  submission_id: string;
  full_name: string;
  email: string;
  phone: string;
  service_type: 'studio' | 'home-call';
  location: string | null;
  preferred_artist: string | null;
  tattoo_idea: string;
  placement: string | null;
  approximate_size: string | null;
  analytics_session_id?: string | null;
}

export type BookingResult = { ok: true; reference: string } | { ok: false; fields?: Record<string, string> };

const REQUEST_TIMEOUT_MS = 20_000;
const REFERENCE_PATTERN = /^BPT-\d{2}-\d{6,}$/;

export async function createBooking(request: BookingRequest): Promise<BookingResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch('/.netlify/functions/create-booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch {
    return { ok: false };
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.error === 'invalid_request' && data.fields) return { ok: false, fields: data.fields };
    return { ok: false };
  }

  // Only a reference produced by the database is ever shown to the visitor.
  return typeof data?.reference === 'string' && REFERENCE_PATTERN.test(data.reference)
    ? { ok: true, reference: data.reference }
    : { ok: false };
}
