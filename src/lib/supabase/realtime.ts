import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client, loaded on demand.
 *
 * Realtime is a live convenience, not part of first paint, so the client is
 * imported dynamically after the feed has mounted. Pulling it into the entry
 * chunk would add well over 200 KB to the landing page for a feature that is
 * not needed until a thread is opened or a count changes.
 */
let pending: Promise<SupabaseClient | null> | null = null;

export function loadRealtimeClient(): Promise<SupabaseClient | null> {
  if (!pending) {
    pending = import('./client')
      .then(module => module.supabase)
      .catch(() => null);
  }
  return pending;
}
