-- Notification state belongs to a lead rather than a browser session. The
-- Netlify booking function claims the pending state before SMTP so a replayed
-- submission cannot produce duplicate administrator emails.
alter table public.booking_leads
  add column notification_status text not null default 'pending',
  add column notification_attempted_at timestamptz,
  add column notification_sent_at timestamptz,
  add column notification_error_code text;

alter table public.booking_leads
  add constraint booking_leads_notification_status_check
    check (notification_status in ('pending', 'sending', 'sent', 'failed')),
  add constraint booking_leads_notification_error_code_length_check
    check (notification_error_code is null or char_length(notification_error_code) <= 40);

create index booking_leads_notification_pending_idx
  on public.booking_leads (notification_status)
  where notification_status = 'pending';
