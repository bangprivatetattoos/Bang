-- Bang Private Tattoos: anonymous booking intents from the video feed.
--
-- The feed's booking flow deliberately collects no name, email or phone before
-- the visitor reaches WhatsApp, so it cannot and must not write to
-- booking_leads, whose columns are all required personal details. This table
-- records only the non-identifying selections the visitor made, so campaign
-- performance and Meta conversions stay measurable.
--
-- booking_leads and the create-booking function are untouched.
--
-- Security model matches booking_leads: RLS enabled with no policies, grants
-- revoked from anon and authenticated, writes only via the service role.

create sequence public.booking_intent_reference_seq as bigint;

create function public.next_booking_intent_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'BPI-' || to_char(now() at time zone 'utc', 'YY') || '-'
    || lpad(n::text, greatest(6, length(n::text)), '0')
  from (select nextval('public.booking_intent_reference_seq') as n) as next_value;
$$;

create table public.booking_intents (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.next_booking_intent_reference(),
  -- Generated per attempt; a retried request reuses it and gets the original
  -- reference back, so one journey can never produce two Meta conversions.
  submission_id uuid not null unique,

  location text not null,
  artist_id text,
  tattoo_type text not null,
  price_range text not null,

  analytics_session_id uuid references public.analytics_sessions(id) on delete set null,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  notification_status text not null default 'pending' check (notification_status in ('pending', 'sending', 'sent', 'failed')),
  notification_attempted_at timestamptz,
  notification_sent_at timestamptz,
  notification_error_code text,

  created_at timestamptz not null default now(),

  constraint booking_intents_location_length check (char_length(location) between 1 and 160),
  constraint booking_intents_artist_format check (
    artist_id is null or (char_length(artist_id) <= 64 and artist_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
  ),
  constraint booking_intents_tattoo_type_length check (char_length(tattoo_type) between 1 and 120),
  constraint booking_intents_price_range_length check (char_length(price_range) between 1 and 120),
  constraint booking_intents_attribution_length check (
    (utm_source is null or char_length(utm_source) <= 200) and
    (utm_medium is null or char_length(utm_medium) <= 200) and
    (utm_campaign is null or char_length(utm_campaign) <= 300)
  ),
  constraint booking_intents_error_code_length check (notification_error_code is null or char_length(notification_error_code) <= 40)
);

create index booking_intents_created_idx on public.booking_intents (created_at desc);
create index booking_intents_analytics_session_idx on public.booking_intents (analytics_session_id);

comment on table public.booking_intents is
  'Anonymous booking selections captured when a visitor continues to WhatsApp from the video feed. Contains no customer name, email or phone by design.';

alter table public.booking_intents enable row level security;

revoke all on table public.booking_intents from anon, authenticated;
revoke all on sequence public.booking_intent_reference_seq from anon, authenticated;
revoke execute on function public.next_booking_intent_reference() from public, anon, authenticated;

grant select, insert, update on table public.booking_intents to service_role;
grant usage on sequence public.booking_intent_reference_seq to service_role;
grant execute on function public.next_booking_intent_reference() to service_role;
