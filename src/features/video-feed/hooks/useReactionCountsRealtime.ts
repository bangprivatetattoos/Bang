import { useEffect } from 'react';
import { loadRealtimeClient } from '../../../lib/supabase/realtime';

interface Options {
  /** The clip on screen. */
  contentId: string | null;
  onCountsChanged: (counts: { like: number; love: number }) => void;
}

/**
 * Live reaction totals for the clip on screen.
 *
 * Subscribes to the aggregate row only — one row, one clip — rather than to
 * every clip in the pool or to the raw reaction rows. The aggregate carries
 * totals and nothing else, so another visitor's reaction updates the count
 * here without ever revealing who reacted.
 */
export function useReactionCountsRealtime({ contentId, onCountsChanged }: Options) {
  useEffect(() => {
    if (!contentId) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    void loadRealtimeClient().then(client => {
      if (!client || disposed) return;

      const channel = client
        .channel(`reactions:${contentId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'content_reaction_counts', filter: `content_id=eq.${contentId}` },
          payload => {
            const row = payload.new as { like_count?: number; love_count?: number } | null;
            if (!row) return;
            onCountsChanged({ like: row.like_count ?? 0, love: row.love_count ?? 0 });
          },
        )
        .subscribe();

      teardown = () => { void client.removeChannel(channel); };
      if (disposed) teardown();
    });

    return () => {
      disposed = true;
      teardown?.();
    };
  }, [contentId, onCountsChanged]);
}
