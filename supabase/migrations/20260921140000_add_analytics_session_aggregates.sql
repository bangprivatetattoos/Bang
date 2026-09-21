-- Aggregated feed analytics.
--
-- Swipes, pauses, playback milestones and carousel movement were each writing
-- a permanent analytics_events row. A single browsing session produced
-- hundreds of them, and no question the business asks is answered by a row per
-- finger movement — the questions are sums: how many clips were genuinely
-- watched, for how long, how deep the visitor went, which pieces held
-- attention.
--
-- So those are summed in the browser and flushed periodically into the
-- session row that already exists, plus one row per clip per session. Business
-- and funnel events are untouched and still recorded individually.
--
-- Additive throughout: no table is dropped, no column removed, no row deleted,
-- and every new column carries a default so existing rows stay valid.
--
-- Deliberately NOT added to the realtime publication. Realtime is for product
-- state the public sees — comments, reaction counts, official replies.
-- Analytics is ordinary ingestion read by the dashboard on demand.

-- ── Session aggregates, onto the table that already identifies the session ──
alter table public.analytics_sessions
  add column if not exists forward_swipes integer not null default 0,
  add column if not exists backward_swipes integer not null default 0,
  add column if not exists videos_entered integer not null default 0,
  add column if not exists unique_videos_viewed integer not null default 0,
  add column if not exists qualified_video_views integer not null default 0,
  add column if not exists videos_completed integer not null default 0,
  add column if not exists videos_replayed integer not null default 0,
  add column if not exists total_watch_seconds integer not null default 0,
  add column if not exists maximum_feed_depth integer not null default 0,
  add column if not exists carousels_viewed integer not null default 0,
  add column if not exists carousel_images_viewed integer not null default 0,
  add column if not exists carousel_manual_swipes integer not null default 0,
  add column if not exists artist_profiles_viewed integer not null default 0,
  add column if not exists booking_started integer not null default 0,
  add column if not exists whatsapp_continued integer not null default 0,
  add column if not exists summary_updated_at timestamptz;

-- Counters are totals, so a negative one is a bug rather than a value. The
-- ceilings are generous but finite: analytics ingestion is a public endpoint,
-- and an unbounded counter is an invitation.
alter table public.analytics_sessions drop constraint if exists analytics_sessions_counter_bounds;
alter table public.analytics_sessions add constraint analytics_sessions_counter_bounds check (
  forward_swipes between 0 and 100000
  and backward_swipes between 0 and 100000
  and videos_entered between 0 and 100000
  and unique_videos_viewed between 0 and 100000
  and qualified_video_views between 0 and 100000
  and videos_completed between 0 and 100000
  and videos_replayed between 0 and 100000
  -- 24 hours. Longer is a stuck clock, not a session.
  and total_watch_seconds between 0 and 86400
  and maximum_feed_depth between 0 and 100000
  and carousels_viewed between 0 and 100000
  and carousel_images_viewed between 0 and 100000
  and carousel_manual_swipes between 0 and 100000
  and artist_profiles_viewed between 0 and 100000
  and booking_started between 0 and 10000
  and whatsapp_continued between 0 and 10000
);

create index if not exists analytics_sessions_summary_idx
  on public.analytics_sessions (started_at desc) where qualified_video_views > 0;

-- ── Per-clip performance, scoped to the session that produced it ────────────
--
-- Scoped to the session rather than accumulated into one global row per clip
-- on purpose. The client sends absolute totals for the session, so applying
-- them is idempotent: a retried or duplicated flush writes the same numbers
-- again and changes nothing. A single global counter would need deltas, and a
-- delta replayed after a network retry silently inflates the metric with no
-- way to detect it afterwards.
--
-- Overall content performance is a SUM over these rows, which the index below
-- supports.
create table if not exists public.analytics_content_sessions (
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  -- The feed's stable content id, the same key comments, reactions and the
  -- media manifest use. Deliberately not a foreign key: the manifest lives in
  -- the application, not the database.
  content_id text not null,
  impressions integer not null default 0,
  qualified_views integer not null default 0,
  completions integer not null default 0,
  replays integer not null default 0,
  watch_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (session_id, content_id),
  constraint analytics_content_sessions_content_id_length check (char_length(content_id) between 1 and 160),
  constraint analytics_content_sessions_bounds check (
    impressions between 0 and 100000
    and qualified_views between 0 and 100000
    and completions between 0 and 100000
    and replays between 0 and 100000
    and watch_seconds between 0 and 86400
  )
);

create index if not exists analytics_content_sessions_content_idx
  on public.analytics_content_sessions (content_id);

comment on table public.analytics_content_sessions is
  'Per-clip engagement within one session. Absolute totals, applied idempotently; overall content performance is a SUM over these rows.';

-- ── Applying a summary ──────────────────────────────────────────────────────
--
-- `greatest` rather than assignment or addition. The client sends running
-- totals, so:
--   * a retry writes the same numbers and changes nothing;
--   * a flush that arrives out of order cannot move a counter backwards;
--   * nothing is ever added twice.
-- Addition would double-count on every retry, and plain assignment would let a
-- stale flush undo a newer one.
create or replace function public.apply_analytics_session_summary(
  p_session_id uuid,
  p_summary jsonb,
  p_content jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exists boolean;
  v_item jsonb;
begin
  select true into v_exists from public.analytics_sessions where id = p_session_id;
  -- No session row yet means the page_view that creates it has not landed.
  -- The caller keeps its totals and tries again rather than inventing a row
  -- without the attribution and device context that belongs on it.
  if v_exists is null then
    return false;
  end if;

  update public.analytics_sessions set
    forward_swipes = greatest(forward_swipes, coalesce((p_summary->>'forwardSwipes')::int, 0)),
    backward_swipes = greatest(backward_swipes, coalesce((p_summary->>'backwardSwipes')::int, 0)),
    videos_entered = greatest(videos_entered, coalesce((p_summary->>'videosEntered')::int, 0)),
    unique_videos_viewed = greatest(unique_videos_viewed, coalesce((p_summary->>'uniqueVideosViewed')::int, 0)),
    qualified_video_views = greatest(qualified_video_views, coalesce((p_summary->>'qualifiedVideoViews')::int, 0)),
    videos_completed = greatest(videos_completed, coalesce((p_summary->>'videosCompleted')::int, 0)),
    videos_replayed = greatest(videos_replayed, coalesce((p_summary->>'videosReplayed')::int, 0)),
    total_watch_seconds = greatest(total_watch_seconds, coalesce((p_summary->>'totalWatchSeconds')::int, 0)),
    maximum_feed_depth = greatest(maximum_feed_depth, coalesce((p_summary->>'maximumFeedDepth')::int, 0)),
    carousels_viewed = greatest(carousels_viewed, coalesce((p_summary->>'carouselsViewed')::int, 0)),
    carousel_images_viewed = greatest(carousel_images_viewed, coalesce((p_summary->>'carouselImagesViewed')::int, 0)),
    carousel_manual_swipes = greatest(carousel_manual_swipes, coalesce((p_summary->>'carouselManualSwipes')::int, 0)),
    artist_profiles_viewed = greatest(artist_profiles_viewed, coalesce((p_summary->>'artistProfilesViewed')::int, 0)),
    booking_started = greatest(booking_started, coalesce((p_summary->>'bookingStarted')::int, 0)),
    whatsapp_continued = greatest(whatsapp_continued, coalesce((p_summary->>'whatsappContinued')::int, 0)),
    last_seen_at = now(),
    summary_updated_at = now()
  where id = p_session_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_content, '[]'::jsonb))
  loop
    insert into public.analytics_content_sessions as target (
      session_id, content_id, impressions, qualified_views, completions, replays, watch_seconds
    ) values (
      p_session_id,
      v_item->>'contentId',
      coalesce((v_item->>'impressions')::int, 0),
      coalesce((v_item->>'qualifiedViews')::int, 0),
      coalesce((v_item->>'completions')::int, 0),
      coalesce((v_item->>'replays')::int, 0),
      coalesce((v_item->>'watchSeconds')::int, 0)
    )
    on conflict (session_id, content_id) do update set
      impressions = greatest(target.impressions, excluded.impressions),
      qualified_views = greatest(target.qualified_views, excluded.qualified_views),
      completions = greatest(target.completions, excluded.completions),
      replays = greatest(target.replays, excluded.replays),
      watch_seconds = greatest(target.watch_seconds, excluded.watch_seconds),
      updated_at = now();
  end loop;

  return true;
end;
$$;

-- ── Security ────────────────────────────────────────────────────────────────
-- The browser never reaches either table directly. Summaries arrive through
-- the Netlify function on the service role, exactly as events already do.
alter table public.analytics_content_sessions enable row level security;
revoke all on table public.analytics_content_sessions from anon, authenticated;
grant select, insert, update on table public.analytics_content_sessions to service_role;

revoke execute on function public.apply_analytics_session_summary(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_analytics_session_summary(uuid, jsonb, jsonb) to service_role;
