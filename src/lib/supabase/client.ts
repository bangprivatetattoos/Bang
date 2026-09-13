import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Browser client using only the public anon key. It never holds a user session;
// the booking form uses it solely to call the create-booking Edge Function.
export const supabase = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;
