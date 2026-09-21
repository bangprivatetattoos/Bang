import { useEffect, useRef, useState } from 'react';
import { useAdminNotifications, type AdminNotification } from './useAdminNotifications';

/**
 * The admin notification centre.
 *
 * Near-real-time through the authenticated endpoint rather than Supabase
 * push — see `useAdminNotifications` for why that is the secure choice here.
 *
 * Opening the dropdown reads nothing. A notification is marked read only when
 * the administrator actually opens it, because an unread badge that clears
 * itself the moment you glance at it is a badge that tells you nothing.
 */

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function ago(iso: string): string {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60], ['minute', 60], ['hour', 24], ['day', 7], ['week', 4.35], ['month', 12], ['year', Infinity],
  ];
  let value = seconds;
  for (const [unit, span] of steps) {
    if (Math.abs(value) < span) return RELATIVE.format(Math.round(value), unit);
    value /= span;
  }
  return iso;
}

const TYPE_LABEL: Record<AdminNotification['type'], string> = {
  comment: 'Comment',
  inquiry: 'Enquiry',
  booking_intent: 'Booking',
  system: 'System',
};

const BellIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 2a6 6 0 0 0-6 6c0 4-1.5 5.5-2 6h16c-.5-.5-2-2-2-6a6 6 0 0 0-6-6z" />
    <path d="M9 18a2 2 0 0 0 4 0" />
  </svg>
);

interface Props {
  /** Where a notification should send the administrator when opened. */
  onOpenEntity?: (notification: AdminNotification) => void;
}

export default function NotificationBell({ onOpenEntity }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Polling runs while the dashboard is mounted, not only while the panel is
  // open, so the badge is current before it is ever clicked.
  const notifications = useAdminNotifications(true);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openNotification = (item: AdminNotification) => {
    // Exactly this one, and only on a deliberate open.
    if (!item.readAt) void notifications.markRead(item.id);
    onOpenEntity?.(item);
  };

  const { unreadCount } = notifications;
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications, none unread'}
        className="relative grid size-10 place-items-center border border-white/12 text-[#f5f5f2] hover:border-white/25"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-[#d7cec1] px-1 font-body text-[10px] font-semibold text-[#111]"
            // The number is already in the button's accessible name, so the
            // badge itself would only repeat it to a screen reader.
            aria-hidden="true"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panel}
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(380px,calc(100vw-2rem))] border border-white/12 bg-[#111] shadow-[0_18px_60px_rgba(0,0,0,.55)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <p className="font-body text-[10px] uppercase tracking-[.16em] text-[#858582]">
              Notifications{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
            </p>
            <div className="flex gap-1">
              {(['all', 'unread'] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => notifications.setFilter(value)}
                  aria-pressed={notifications.filter === value}
                  className={`border px-2 py-1 font-body text-[10px] uppercase tracking-[.1em] ${
                    notifications.filter === value
                      ? 'border-[#f5f5f2] bg-[#f5f5f2] text-[#111]'
                      : 'border-white/12 text-[#b7b7b2]'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {notifications.error && (
              <p aria-live="polite" className="px-4 py-3 font-body text-xs text-[#d7cec1]">
                Could not refresh just now. Retrying automatically.
              </p>
            )}
            {notifications.notifications.length === 0 ? (
              <p className="px-4 py-8 text-center font-body text-xs text-[#858582]">
                {notifications.loading ? 'Loading…' : 'Nothing to review.'}
              </p>
            ) : (
              <ul>
                {notifications.notifications.map(item => (
                  <li key={item.id} className="border-b border-white/7 last:border-b-0">
                    <div className="flex items-start gap-2 px-4 py-3">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openNotification(item)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-center gap-2">
                          {/* Unread is carried by the word below as well as
                              the dot, so it is not colour alone. */}
                          {!item.readAt && <i aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[#d7cec1]" />}
                          <span className="font-body text-[9px] uppercase tracking-[.16em] text-[#858582]">
                            {TYPE_LABEL[item.type] ?? item.type}{!item.readAt ? ' · Unread' : ''}
                          </span>
                        </span>
                        <span className="mt-1 block truncate font-body text-sm text-[#f5f5f2]">{item.title}</span>
                        {item.summary && (
                          <span className="mt-0.5 block truncate font-body text-xs text-[#b7b7b2]">{item.summary}</span>
                        )}
                        <span className="mt-1 block font-body text-[10px] text-[#858582]">{ago(item.createdAt)}</span>
                      </button>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => (item.readAt ? notifications.markUnread(item.id) : notifications.markRead(item.id))}
                          className="border border-white/12 px-2 py-1 font-body text-[9px] uppercase text-[#b7b7b2] hover:border-white/25"
                        >
                          {item.readAt ? 'Unread' : 'Read'}
                        </button>
                        <button
                          type="button"
                          onClick={() => notifications.remove(item.id)}
                          // Wording matters: this dismisses the alert. The
                          // comment, enquiry or booking behind it is untouched.
                          title="Dismiss this alert. The comment, enquiry or booking is not deleted."
                          className="border border-white/12 px-2 py-1 font-body text-[9px] uppercase text-[#858582] hover:border-white/25"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
