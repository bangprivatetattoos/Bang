-- Bang Private Tattoos: comments and reactions on video feed content.
--
-- Security model
--   * Row Level Security is enabled with intentionally NO policies, and all
--     grants are revoked from anon and authenticated, exactly as for
--     booking_leads. Browsers never read or write these tables directly.
--   * A visitor's contact detail (`contact_value`) lives in a SEPARATE table
--     from the publicly readable comment text. The public feed endpoint reads
--     only public.content_comments, which has no contact column at all, so
--     there is no query shape — client or server — that can leak it alongside
--     a published comment.
--   * Comments are created with status 'pending'. Nothing a visitor types
--     becomes publicly visible until it is approved.

create table public.content_comments (
  id uuid primary key default gen_random_uuid(),
  -- Feed content id (the video manifest's slug). Deliberately not a foreign
  -- key: the media manifest lives in the application, not the database.
  content_id text not null,
  display_name text not null,
  comment text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Anonymous analytics session, for moderation context only.
  analytics_session_id uuid references public.analytics_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,

  constraint content_comments_content_id_length check (char_length(content_id) between 1 and 120),
  constraint content_comments_display_name_length check (char_length(display_name) between 1 and 60),
  constraint content_comments_comment_length check (char_length(comment) between 1 and 1200)
);

create index content_comments_public_idx on public.content_comments (content_id, status, created_at desc);

comment on table public.content_comments is
  'Visitor comments on feed content. Public text only — contact details live in content_comment_contacts. Written only by the content-comments function.';

-- Private contact details, split out so they can never be selected by the same
-- query that serves public comment text.
create table public.content_comment_contacts (
  comment_id uuid primary key references public.content_comments(id) on delete cascade,
  contact_kind text not null check (contact_kind in ('email', 'phone')),
  contact_value text not null,
  created_at timestamptz not null default now(),

  constraint content_comment_contacts_value_length check (char_length(contact_value) between 3 and 254)
);

comment on table public.content_comment_contacts is
  'Private follow-up contact details for a comment. Never exposed through any public endpoint.';

create table public.content_reactions (
  content_id text not null,
  -- Anonymous per-browser identifier from the existing analytics client. No
  -- account, no contact detail, and one reaction per visitor per clip.
  visitor_id uuid not null,
  reaction text not null check (reaction in ('like', 'love')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (content_id, visitor_id),
  constraint content_reactions_content_id_length check (char_length(content_id) between 1 and 120)
);

create index content_reactions_content_idx on public.content_reactions (content_id);

comment on table public.content_reactions is
  'Anonymous reactions on feed content, keyed by content id and analytics visitor id.';

alter table public.content_comments enable row level security;
alter table public.content_comment_contacts enable row level security;
alter table public.content_reactions enable row level security;

revoke all on table public.content_comments, public.content_comment_contacts, public.content_reactions from anon, authenticated;

grant select, insert, update, delete on table public.content_comments, public.content_comment_contacts, public.content_reactions to service_role;
