import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Admin notifications, fetched through the authenticated Netlify endpoint.
 *
 * This is near-real-time polling, NOT Supabase realtime push, and that is
 * deliberate. `admin_notifications` is private: it has no anon grant, no anon
 * policy and is not in the realtime publication. The admin authenticates with
 * the custom session cookie rather than Supabase Auth, so a browser
 * subscription could not be authorised as that admin anyway — the only way to
 * get push here would be to expose private rows to public clients, which is a
 * security regression, not a feature.
 *
 * So it polls, on one shared timer, and only while someone is actually
 * looking: on mount, when the tab becomes visible again, after an admin
 * action, and on a modest interval otherwise.
 */

export interface AdminNotification {
  id: string;
  type: 'comment' | 'inquiry' | 'booking_intent' | 'system';
  title: string;
  summary: string | null;
  entityType: string | null;
  entityId: string | null;
  contentId: string | null;
  createdAt: string;
  readAt: string | null;
}

const ENDPOINT = '/.netlify/functions/admin-notifications';

/** Slow enough not to hammer the function, quick enough to feel current. */
const POLL_MS = 15_000;

export type NotificationFilter = 'all' | 'unread';

export function useAdminNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  /** One timer for the whole dashboard, cleared on every path out. */
  const timer = useRef<number | null>(null);
  /** Guards against two requests overlapping and landing out of order. */
  const inFlight = useRef(false);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const refresh = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch(`${ENDPOINT}?filter=${filterRef.current}&pageSize=25`, {
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json();
      setNotifications(body.notifications ?? []);
      setUnreadCount(body.unreadCount ?? 0);
      setError(false);
    } catch {
      // A failed poll is not worth disturbing the dashboard over; the next
      // tick tries again and the badge keeps its last known value.
      setError(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [enabled]);

  /**
   * One timer, started only while the dashboard is mounted AND the tab is
   * visible. A hidden tab polls nothing: the refresh on becoming visible
   * again catches it up in one request.
   */
  useEffect(() => {
    if (!enabled) return;

    const stop = () => {
      if (timer.current !== null) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    };

    const start = () => {
      stop();
      timer.current = window.setInterval(() => { void refresh(); }, POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
        start();
      } else {
        stop();
      }
    };

    void refresh();
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, refresh]);

  // Changing the filter is a deliberate request for fresh data.
  useEffect(() => { void refresh(); }, [filter, refresh]);

  const mutate = useCallback(async (action: 'mark_read' | 'mark_unread' | 'delete', ids: string[]) => {
    if (ids.length === 0) return;

    // Applied locally first so the badge moves the moment it is clicked; the
    // response carries the authoritative count and corrects it either way.
    setNotifications(current => {
      if (action === 'delete') return current.filter(item => !ids.includes(item.id));
      const readAt = action === 'mark_read' ? new Date().toISOString() : null;
      return current.map(item => (ids.includes(item.id) ? { ...item, readAt } : item));
    });

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json();
      if (typeof body.unreadCount === 'number') setUnreadCount(body.unreadCount);
    } catch {
      // The optimistic edit was wrong; re-read rather than leave it showing.
      void refresh();
    }
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    filter,
    setFilter,
    loading,
    error,
    refresh,
    /** Marks exactly one notification read. Never a bulk sweep. */
    markRead: (id: string) => mutate('mark_read', [id]),
    markUnread: (id: string) => mutate('mark_unread', [id]),
    /** Soft-deletes the alert only; the comment, enquiry or booking is untouched. */
    remove: (id: string) => mutate('delete', [id]),
  };
}
