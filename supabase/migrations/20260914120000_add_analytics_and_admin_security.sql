-- Bang Private Tattoos: first-party behavioral analytics and protected admin access.
-- All writes/reads are performed by trusted server-side functions using service_role.
-- No public role is granted direct access to any analytics or security record.

create table public.analytics_sessions (
  id uuid primary key,
  visitor_id uuid not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  landing_path text not null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  country text,
  country_code text,
  region text,
  region_code text,
  city text,
  device_type text not null default 'other' check (device_type in ('mobile', 'tablet', 'desktop', 'other')),
  operating_system text,
  browser text,
  created_at timestamptz not null default now(),
  constraint analytics_sessions_landing_path_length check (char_length(landing_path) between 1 and 500),
  constraint analytics_sessions_referrer_length check (referrer is null or char_length(referrer) <= 2048),
  constraint analytics_sessions_attribution_length check (
    (utm_source is null or char_length(utm_source) <= 200) and
    (utm_medium is null or char_length(utm_medium) <= 200) and
    (utm_campaign is null or char_length(utm_campaign) <= 300) and
    (utm_content is null or char_length(utm_content) <= 300) and
    (utm_term is null or char_length(utm_term) <= 300)
  )
);

create index analytics_sessions_started_at_idx on public.analytics_sessions (started_at desc);
create index analytics_sessions_visitor_id_idx on public.analytics_sessions (visitor_id, last_seen_at desc);
create index analytics_sessions_attribution_idx on public.analytics_sessions (utm_source, utm_campaign);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null unique,
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  event_name text not null check (event_name in (
    'page_view', 'artist_view', 'artist_gallery_open', 'book_artist_click',
    'portfolio_view', 'portfolio_image_open', 'booking_start', 'booking_success',
    'whatsapp_click', 'home_call_view', 'home_call_click', 'faq_open'
  )),
  page_path text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_page_path_length check (char_length(page_path) between 1 and 500),
  constraint analytics_events_entity_type_length check (entity_type is null or char_length(entity_type) <= 64),
  constraint analytics_events_entity_id_length check (entity_id is null or char_length(entity_id) <= 160),
  constraint analytics_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index analytics_events_session_created_idx on public.analytics_events (session_id, created_at desc);
create index analytics_events_name_created_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_entity_idx on public.analytics_events (entity_type, entity_id);

alter table public.booking_leads
  add column analytics_session_id uuid references public.analytics_sessions(id) on delete set null;
create index booking_leads_analytics_session_idx on public.booking_leads (analytics_session_id);

-- Pin material is deliberately hash-only. The one row is created by scripts/set-admin-pin.mjs.
create table public.admin_security (
  singleton boolean primary key default true check (singleton),
  pin_hash text not null,
  pin_salt text not null,
  security_version uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  constraint admin_security_hash_length check (char_length(pin_hash) between 32 and 512),
  constraint admin_security_salt_length check (char_length(pin_salt) between 16 and 512)
);

create table public.admin_login_lockouts (
  source_hash text primary key,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  last_failed_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint admin_login_lockouts_source_hash_length check (char_length(source_hash) between 32 and 128)
);

create table public.admin_access_events (
  id uuid primary key default gen_random_uuid(),
  outcome text not null check (outcome in ('success', 'failure', 'locked', 'logout')),
  source_hash text not null,
  created_at timestamptz not null default now(),
  constraint admin_access_events_source_hash_length check (char_length(source_hash) between 32 and 128)
);
create index admin_access_events_created_idx on public.admin_access_events (created_at desc);

-- Server-side rate limiting for the public collector: 120 events per hashed source per minute.
create table public.analytics_ingestion_limits (
  source_hash text not null,
  bucket_start timestamptz not null,
  event_count integer not null default 0 check (event_count >= 0),
  primary key (source_hash, bucket_start)
);

create function public.consume_analytics_rate_limit(p_source_hash text, p_limit integer default 120)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_bucket timestamptz := date_trunc('minute', now());
begin
  insert into public.analytics_ingestion_limits (source_hash, bucket_start, event_count)
  values (p_source_hash, current_bucket, 1)
  on conflict (source_hash, bucket_start) do update
    set event_count = public.analytics_ingestion_limits.event_count + 1
    where public.analytics_ingestion_limits.event_count < p_limit;
  return found;
end;
$$;

create function public.record_admin_login_failure(p_source_hash text)
returns table (attempts_remaining integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_attempts integer;
  next_lock timestamptz;
begin
  insert into public.admin_login_lockouts (source_hash, failed_attempts, last_failed_at, updated_at)
  values (p_source_hash, 1, now(), now())
  on conflict (source_hash) do update
    set failed_attempts = case
      when public.admin_login_lockouts.locked_until is not null and public.admin_login_lockouts.locked_until > now() then public.admin_login_lockouts.failed_attempts
      else public.admin_login_lockouts.failed_attempts + 1
    end,
    last_failed_at = now(),
    locked_until = case
      when public.admin_login_lockouts.locked_until is not null and public.admin_login_lockouts.locked_until > now() then public.admin_login_lockouts.locked_until
      when public.admin_login_lockouts.failed_attempts + 1 >= 5 then now() + interval '30 minutes'
      else null
    end,
    updated_at = now()
  returning admin_login_lockouts.failed_attempts, admin_login_lockouts.locked_until into next_attempts, next_lock;
  return query select greatest(0, 5 - next_attempts), next_lock;
end;
$$;

create function public.clear_admin_login_lockout(p_source_hash text)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.admin_login_lockouts where source_hash = p_source_hash; $$;

-- RLS plus revoked grants ensure browser anon/authenticated roles cannot query or mutate analytics/security tables.
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.admin_security enable row level security;
alter table public.admin_login_lockouts enable row level security;
alter table public.admin_access_events enable row level security;
alter table public.analytics_ingestion_limits enable row level security;

revoke all on table public.analytics_sessions, public.analytics_events, public.admin_security,
  public.admin_login_lockouts, public.admin_access_events, public.analytics_ingestion_limits from anon, authenticated;
revoke all on function public.consume_analytics_rate_limit(text, integer), public.record_admin_login_failure(text), public.clear_admin_login_lockout(text) from public, anon, authenticated;

grant select, insert, update, delete on table public.analytics_sessions, public.analytics_events, public.admin_security,
  public.admin_login_lockouts, public.admin_access_events, public.analytics_ingestion_limits to service_role;
grant execute on function public.consume_analytics_rate_limit(text, integer), public.record_admin_login_failure(text), public.clear_admin_login_lockout(text) to service_role;
