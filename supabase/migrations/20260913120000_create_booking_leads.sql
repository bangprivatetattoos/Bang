-- Bang Private Tattoos: consultation leads from the public booking form.
--
-- Security model
--   * Row Level Security is enabled with intentionally NO policies, so the
--     public anon and authenticated roles can never list, read, update or
--     delete leads.
--   * Table, sequence and function privileges are also revoked from anon and
--     authenticated, because Supabase grants them by default in public.
--   * Leads are created only by the create-booking Edge Function, which
--     validates each request and writes with the service role on the server.

-- Booking references (BPT-YY-NNNNNN) come from a sequence, so concurrent
-- submissions can never receive the same number. Numbers consumed by failed
-- inserts leave gaps, which is expected.
create sequence public.booking_reference_seq as bigint;

create function public.next_booking_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'BPT-' || to_char(now() at time zone 'utc', 'YY') || '-'
    || lpad(n::text, greatest(6, length(n::text)), '0')
  from (select nextval('public.booking_reference_seq') as n) as next_value;
$$;

create table public.booking_leads (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.next_booking_reference(),
  -- Generated per submission attempt; a retried request reuses it and gets the
  -- original reference back instead of creating a duplicate lead.
  submission_id uuid not null unique,
  full_name text not null,
  email text not null,
  phone text not null,
  service_type text not null,
  location text,
  preferred_artist text,
  tattoo_idea text not null,
  placement text,
  approximate_size text,
  status text not null default 'new',
  created_at timestamptz not null default now(),

  constraint booking_leads_full_name_length check (char_length(full_name) between 1 and 120),
  constraint booking_leads_email_format check (
    char_length(email) <= 254
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint booking_leads_phone_length check (char_length(phone) between 7 and 32),
  constraint booking_leads_service_type check (service_type in ('studio', 'home-call')),
  constraint booking_leads_location_length check (char_length(location) between 1 and 160),
  constraint booking_leads_home_call_location check (service_type <> 'home-call' or location is not null),
  constraint booking_leads_preferred_artist_format check (
    char_length(preferred_artist) <= 64
    and preferred_artist ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint booking_leads_tattoo_idea_length check (char_length(tattoo_idea) between 1 and 4000),
  constraint booking_leads_placement_length check (char_length(placement) between 1 and 120),
  constraint booking_leads_approximate_size_length check (char_length(approximate_size) between 1 and 120)
);

comment on table public.booking_leads is
  'Consultation requests from the public booking form. Written only by the create-booking Edge Function.';

alter table public.booking_leads enable row level security;

revoke all on table public.booking_leads from anon, authenticated;
revoke all on sequence public.booking_reference_seq from anon, authenticated;
revoke execute on function public.next_booking_reference() from public, anon, authenticated;

grant select, insert on table public.booking_leads to service_role;
grant usage on sequence public.booking_reference_seq to service_role;
grant execute on function public.next_booking_reference() to service_role;
