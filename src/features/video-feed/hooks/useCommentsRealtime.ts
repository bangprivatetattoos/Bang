import { useEffect } from 'react';
import { loadRealtimeClient } from '../../../lib/supabase/realtime';

interface Options {
  /** The clip whose comment thread is on screen, or null when none is. */
  contentId: string | null;
  /** A visible comment was inserted, or one changed status. */
  onCommentsChanged: () => void;
}

/**
 * Live comment updates for the thread currently open.
 *
 * One channel, scoped to the one clip being viewed — not one per clip in the
 * pool. It is torn down as soon as the thread closes or the clip changes, so
 * a long browsing session never accumulates subscriptions.
 *
 * The browser subscribes with the public anon key and can only see rows the
 * RLS policies expose: visible comment text and visible official replies. Raw
 * reaction rows, comment contact details and enquiries are not published to
 * realtime at all.
 */
export function useCommentsRealtime({ contentId, onCommentsChanged }: Options) {
  useEffect(() => {
    if (!contentId) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    void loadRealtimeClient().then(client => {
      if (!client || disposed) return;

      const channel = client
        .channel(`comments:${contentId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'content_comments', filter: `content_id=eq.${contentId}` },
          () => onCommentsChanged(),
        )
        // Replies carry no content_id of their own, so they are narrowed by
        // the refetch rather than by the subscription filter.
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'comment_replies' },
          () => onCommentsChanged(),
        )
        .subscribe();

      teardown = () => { void client.removeChannel(channel); };
      // The effect may already have been cleaned up while the client loaded.
      if (disposed) teardown();
    });

    return () => {
      disposed = true;
      teardown?.();
    };
  }, [contentId, onCommentsChanged]);
}
