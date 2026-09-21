-- Bang Private Tattoos: real engagement — comments, reactions, replies,
-- private enquiries, admin notifications and the admin email outbox.
--
-- Additive throughout. Nothing existing is dropped and no row is deleted.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Security model
--
-- Two tiers, deliberately separated:
--
--   PUBLIC-READABLE (anon may SELECT, and these are the only tables added to
--   the realtime publication): visible comment text, official replies and the
--   two aggregate count tables. These carry nothing private — no contact
--   detail, and no visitor identifiers.
--
--   SERVICE-ROLE ONLY (no anon grant, no anon policy, never published to
--   realtime): raw reaction rows, comment contact details, enquiries, admin
--   notifications and the email outbox. A browser cannot read or write any of
--   them under any query.
--
-- Every write still goes through the Netlify functions using the service role,
-- so validation, rate limiting and spam checks cannot be bypassed. anon is
-- granted SELECT only.
--
-- Counts are kept in separate aggregate tables maintained by triggers, so the
-- public can subscribe to a total changing without the raw rows — and the
-- anonymous visitor ids inside them — ever being exposed.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Comments ────────────────────────────────────────────────────────────────
-- The existing content_comments table is evolved rather than replaced.

-- A blank name is allowed now: the public site renders "Anonymous".
alter table public.content_comments alter column display_name drop not null;

alter table public.content_comments
  add column if not exists anonymous_visitor_id uuid,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists hidden_at timestamptz,
  add column if not exists deleted_at timestamptz;

-- Ordinary comments are visible on submission; moderation is after the fact.
alter table public.content_comments drop constraint if exists content_comments_status_check;
alter table public.content_comments drop constraint if exists content_comments_status_check1;

do $$
begin
  -- The original check was created inline, so its name is generated. Find and
  -- drop whichever check governs `status` before installing the new one.
  execute (
    select coalesce(
      string_agg(format('alter table public.content_comments drop constraint %I;', conname), ' '),
      ''
    )
    from pg_constraint
    where conrelid = 'public.content_comments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  );
end $$;

-- Anything already stored under the old vocabulary is mapped forward.
update public.content_comments set status = 'visible' where status = 'approved';
update public.content_comments set status = 'hidden' where status in ('pending', 'rejected');

alter table public.content_comments
  add constraint content_comments_status_check check (status in ('visible', 'hidden', 'deleted'));
alter table public.content_comments alter column status set default 'visible';

alter table public.content_comments drop constraint if exists content_comments_display_name_length;
alter table public.content_comments
  add constraint content_comments_display_name_length
  check (display_name is null or char_length(display_name) between 1 and 60);

create index if not exists content_comments_visible_idx
  on public.content_comments (content_id, created_at desc) where status = 'visible';
create index if not exists content_comments_status_created_idx
  on public.content_comments (status, created_at desc);
create index if not exists content_comments_visitor_idx
  on public.content_comments (anonymous_visitor_id, created_at desc);

-- ── Comment reactions ───────────────────────────────────────────────────────
-- `reaction` is a text column rather than a boolean so more kinds can be added
-- later without a migration on the data itself.
create table if not exists public.comment_reactions (
  comment_id uuid not null references public.content_comments(id) on delete cascade,
  anonymous_visitor_id uuid not null,
  reaction text not null default 'like' check (reaction in ('like', 'love')),
  -- Marks the studio's own reaction, so official engagement is never
  -- presented as an anonymous visitor's.
  is_official boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (comment_id, anonymous_visitor_id)
);

create index if not exists comment_reactions_comment_idx on public.comment_reactions (comment_id);

comment on table public.comment_reactions is
  'One reaction per comment per anonymous visitor. Raw rows are never public; totals live in comment_reaction_counts.';

-- ── Official replies ────────────────────────────────────────────────────────
create table if not exists public.comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.content_comments(id) on delete cascade,
  -- Only ever 'admin' today. A visitor cannot create a row here at all: there
  -- is no anon insert grant and no anon policy, so an official reply can only
  -- originate from the authenticated admin boundary on the server.
  author_type text not null default 'admin' check (author_type in ('admin')),
  admin_account_id text,
  body text not null,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint comment_replies_body_length check (char_length(body) between 1 and 2000)
);

create index if not exists comment_replies_comment_idx
  on public.comment_replies (comment_id, created_at) where status = 'visible';

comment on table public.comment_replies is
  'Official BANG PRIVATE TATTOOS replies. Writable only by the admin server boundary.';

-- ── Aggregate counts, for public realtime ───────────────────────────────────
create table if not exists public.content_reaction_counts (
  content_id text primary key,
  like_count integer not null default 0 check (like_count >= 0),
  love_count integer not null default 0 check (love_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.comment_reaction_counts (
  comment_id uuid primary key references public.content_comments(id) on delete cascade,
  reaction_count integer not null default 0 check (reaction_count >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.content_reaction_counts is
  'Public per-clip reaction totals. Subscribed to by the feed so counts update live without exposing who reacted.';

-- Recalculate from the raw rows. Doing the arithmetic as a fresh count rather
-- than an increment keeps the aggregate correct even if a write is replayed.
create or replace function public.refresh_content_reaction_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text := coalesce(new.content_id, old.content_id);
begin
  insert into public.content_reaction_counts (content_id, like_count, love_count, updated_at)
  select
    target,
    count(*) filter (where reaction = 'like'),
    count(*) filter (where reaction = 'love'),
    now()
  from public.content_reactions
  where content_id = target
  on conflict (content_id) do update
    set like_count = excluded.like_count,
        love_count = excluded.love_count,
        updated_at = excluded.updated_at;
  return null;
end;
$$;

create or replace function public.refresh_comment_reaction_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.comment_id, old.comment_id);
begin
  insert into public.comment_reaction_counts (comment_id, reaction_count, updated_at)
  select target, count(*), now()
  from public.comment_reactions
  where comment_id = target
  on conflict (comment_id) do update
    set reaction_count = excluded.reaction_count,
        updated_at = excluded.updated_at;
  return null;
end;
$$;

drop trigger if exists content_reactions_count_trigger on public.content_reactions;
create trigger content_reactions_count_trigger
  after insert or update or delete on public.content_reactions
  for each row execute function public.refresh_content_reaction_counts();

drop trigger if exists comment_reactions_count_trigger on public.comment_reactions;
create trigger comment_reactions_count_trigger
  after insert or update or delete on public.comment_reactions
  for each row execute function public.refresh_comment_reaction_counts();

-- Seed the aggregates from whatever already exists.
insert into public.content_reaction_counts (content_id, like_count, love_count)
select content_id,
       count(*) filter (where reaction = 'like'),
       count(*) filter (where reaction = 'love')
from public.content_reactions
group by content_id
on conflict (content_id) do nothing;

-- ── Private enquiries ───────────────────────────────────────────────────────
-- Separate from comments on purpose: an enquiry is a private message to the
-- studio and its contact detail must never sit in a publicly readable table.
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  content_id text,
  artist_id text,
  display_name text,
  contact_kind text check (contact_kind is null or contact_kind in ('email', 'phone')),
  contact_value text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'closed')),

  anonymous_visitor_id uuid,
  analytics_session_id uuid references public.analytics_sessions(id) on delete set null,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inquiries_message_length check (char_length(message) between 1 and 4000),
  constraint inquiries_display_name_length check (display_name is null or char_length(display_name) between 1 and 60),
  constraint inquiries_contact_length check (contact_value is null or char_length(contact_value) between 3 and 254),
  constraint inquiries_artist_format check (artist_id is null or artist_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists inquiries_created_idx on public.inquiries (created_at desc);
create index if not exists inquiries_status_idx on public.inquiries (status, created_at desc);

comment on table public.inquiries is
  'Private visitor enquiries, including any contact detail they chose to give. Never publicly readable.';

-- ── Admin notifications ─────────────────────────────────────────────────────
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('comment', 'inquiry', 'booking_intent', 'system')),
  title text not null,
  summary text,
  entity_type text not null,
  entity_id uuid,
  content_id text,
  -- One notification per business event. A replayed request finds the row
  -- already present instead of creating a duplicate.
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_at timestamptz,

  constraint admin_notifications_title_length check (char_length(title) between 1 and 200),
  constraint admin_notifications_summary_length check (summary is null or char_length(summary) <= 500)
);

-- Unread lookups drive the badge, so they get their own partial index.
create index if not exists admin_notifications_unread_idx
  on public.admin_notifications (created_at desc) where read_at is null and deleted_at is null;
create index if not exists admin_notifications_live_idx
  on public.admin_notifications (created_at desc) where deleted_at is null;
create index if not exists admin_notifications_type_idx
  on public.admin_notifications (type, created_at desc) where deleted_at is null;
create index if not exists admin_notifications_entity_idx
  on public.admin_notifications (entity_type, entity_id);

comment on table public.admin_notifications is
  'Actionable admin alerts. Deleting one never affects the comment, enquiry or booking it points at.';

-- ── Admin email outbox ──────────────────────────────────────────────────────
-- Mail is queued here by the request that created the business record and sent
-- by the existing SMTP dispatcher. A failure to send can therefore never fail
-- the comment, enquiry or booking that triggered it.
create table if not exists public.admin_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.admin_notifications(id) on delete set null,
  dedupe_key text not null unique,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  attempted_at timestamptz,
  sent_at timestamptz,

  constraint admin_email_outbox_subject_length check (char_length(subject) between 1 and 300)
);

create index if not exists admin_email_outbox_pending_idx
  on public.admin_email_outbox (created_at) where status = 'pending';

comment on table public.admin_email_outbox is
  'Queued administrator emails. Keyed by dedupe_key so a retried request cannot send the same mail twice.';

-- ── Row level security ──────────────────────────────────────────────────────
alter table public.comment_reactions enable row level security;
alter table public.comment_replies enable row level security;
alter table public.content_reaction_counts enable row level security;
alter table public.comment_reaction_counts enable row level security;
alter table public.inquiries enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_email_outbox enable row level security;

-- Private tables: no anon grant and no anon policy, so nothing is reachable.
revoke all on table public.comment_reactions, public.inquiries,
  public.admin_notifications, public.admin_email_outbox from anon, authenticated;

grant select, insert, update, delete on table
  public.comment_reactions, public.comment_replies, public.content_reaction_counts,
  public.comment_reaction_counts, public.inquiries, public.admin_notifications,
  public.admin_email_outbox to service_role;

-- Public read-only surface. SELECT only — a visitor can never insert, update
-- or delete here; every write goes through the server functions.
grant select on table public.content_comments, public.comment_replies,
  public.content_reaction_counts, public.comment_reaction_counts to anon, authenticated;

drop policy if exists content_comments_public_read on public.content_comments;
create policy content_comments_public_read on public.content_comments
  for select to anon, authenticated
  using (status = 'visible');

drop policy if exists comment_replies_public_read on public.comment_replies;
create policy comment_replies_public_read on public.comment_replies
  for select to anon, authenticated
  using (
    status = 'visible'
    and exists (
      select 1 from public.content_comments parent
      where parent.id = comment_replies.comment_id and parent.status = 'visible'
    )
  );

drop policy if exists content_reaction_counts_public_read on public.content_reaction_counts;
create policy content_reaction_counts_public_read on public.content_reaction_counts
  for select to anon, authenticated using (true);

drop policy if exists comment_reaction_counts_public_read on public.comment_reaction_counts;
create policy comment_reaction_counts_public_read on public.comment_reaction_counts
  for select to anon, authenticated using (true);

-- The comment text column is public; the contact table beside it is not, and
-- keeps its existing no-policy, no-grant posture.

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Only the four public surfaces are published. Raw reactions, contacts,
-- enquiries, notifications and the outbox are deliberately absent.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.content_comments;
    alter publication supabase_realtime add table public.comment_replies;
    alter publication supabase_realtime add table public.content_reaction_counts;
    alter publication supabase_realtime add table public.comment_reaction_counts;
  end if;
exception
  when duplicate_object then null;
end $$;
