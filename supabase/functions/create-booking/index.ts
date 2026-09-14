// create-booking: the public endpoint behind the Bang Private Tattoos booking form.
// It re-validates the request, stores it in public.booking_leads with the service
// role (available only on the server), and returns just the database-generated
// booking reference. Nothing else about stored leads is ever returned.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { validateBooking } from './validation.ts';

const MAX_BODY_BYTES = 32_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Both values are provided to Edge Functions by Supabase automatically.
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  if (!supabase) {
    console.error('create-booking: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return json(500, { error: 'server_error' });
  }

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json(413, { error: 'payload_too_large' });
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' });
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const result = validateBooking(body);
  if (!result.ok) return json(400, { error: 'invalid_request', fields: result.fields });
  let { lead } = result;

  // Analytics is optional for booking. Never fail a legitimate consultation
  // because a visitor's anonymous session was unavailable or has expired.
  if (lead.analytics_session_id) {
    const session = await supabase.from('analytics_sessions').select('id').eq('id', lead.analytics_session_id).maybeSingle();
    if (session.error || !session.data) lead = { ...lead, analytics_session_id: null };
  }

  try {
    const { data, error } = await supabase.from('booking_leads').insert(lead).select('reference').single();
    if (!error) return json(201, { reference: data.reference });

    // 23505 is a unique violation. A retried submission (double click, lost
    // response) reuses its submission_id, so return the reference already created.
    if (error.code === '23505') {
      const existing = await supabase
        .from('booking_leads')
        .select('reference, email')
        .eq('submission_id', lead.submission_id)
        .maybeSingle();
      if (existing.data && existing.data.email === lead.email) {
        return json(200, { reference: existing.data.reference });
      }
    }

    console.error('create-booking: insert failed', error.code, error.message);
  } catch (error) {
    console.error('create-booking: unexpected error', error instanceof Error ? error.message : error);
  }

  return json(500, { error: 'server_error' });
});
