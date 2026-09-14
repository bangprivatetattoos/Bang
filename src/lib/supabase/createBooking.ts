import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './client';

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
  if (!supabase) {
    console.error('Booking backend is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    return { ok: false };
  }

  const { data, error } = await supabase.functions.invoke('create-booking', { body: request, timeout: REQUEST_TIMEOUT_MS });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error === 'invalid_request' && body.fields) return { ok: false, fields: body.fields };
    }
    return { ok: false };
  }

  // Only a reference produced by the database is ever shown to the visitor.
  return typeof data?.reference === 'string' && REFERENCE_PATTERN.test(data.reference)
    ? { ok: true, reference: data.reference }
    : { ok: false };
}
