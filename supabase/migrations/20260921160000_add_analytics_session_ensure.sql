-- Race-safe creation of an analytics session row.
--
-- Three problems, one function.
--
-- 1. The summary endpoint could not create a session, so a summary arriving
--    before the page_view that creates one was answered 409 and kept client
--    side. A visitor who left before the next flush lost that summary.
--
-- 2. `track` created sessions with a read-then-write: SELECT, then INSERT or
--    UPDATE. Two concurrent first requests can both see "absent" and both
--    insert, and one then fails on the primary key.
--
-- 3. When the row already existed, `track` updated only `last_seen_at`. It
--    never filled in attribution, so a row created by any other path would
--    stay bare forever.
--
-- This does an atomic upsert whose conflict branch fills in NULLs and nothing
-- else. Whichever request arrives first creates the row; later ones enrich it
-- and can never blank a field that already has a value.
--
-- Additive: no table or column is altered, and the existing summary function
-- is untouched.

create or replace function public.ensure_analytics_session(
  p_id uuid,
  p_visitor_id uuid,
  p_landing_path text,
  p_referrer text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_country text default null,
  p_country_code text default null,
  p_region text default null,
  p_region_code text default null,
  p_city text default null,
  p_device_type text default null,
  p_operating_system text default null,
  p_browser text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_sessions as target (
    id, visitor_id, landing_path, referrer,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    country, country_code, region, region_code, city,
    device_type, operating_system, browser
  ) values (
    p_id,
    p_visitor_id,
    -- NOT NULL on the table, and a path is the one thing every caller has.
    coalesce(nullif(p_landing_path, ''), '/'),
    p_referrer,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    p_country, p_country_code, p_region, p_region_code, p_city,
    -- The column's check constraint accepts only these four.
    coalesce(nullif(p_device_type, ''), 'other'),
    p_operating_system, p_browser
  )
  on conflict (id) do update set
    -- Fill blanks only. `coalesce(existing, incoming)` keeps whatever the row
    -- already knows, so a later request carrying no attribution -- a summary
    -- flush, say -- cannot erase what the page_view recorded, in either
    -- arrival order.
    referrer = coalesce(target.referrer, excluded.referrer),
    utm_source = coalesce(target.utm_source, excluded.utm_source),
    utm_medium = coalesce(target.utm_medium, excluded.utm_medium),
    utm_campaign = coalesce(target.utm_campaign, excluded.utm_campaign),
    utm_content = coalesce(target.utm_content, excluded.utm_content),
    utm_term = coalesce(target.utm_term, excluded.utm_term),
    country = coalesce(target.country, excluded.country),
    country_code = coalesce(target.country_code, excluded.country_code),
    region = coalesce(target.region, excluded.region),
    region_code = coalesce(target.region_code, excluded.region_code),
    city = coalesce(target.city, excluded.city),
    -- 'other' is the default rather than a measurement, so a real
    -- classification arriving later is allowed to replace it.
    device_type = case
      when target.device_type = 'other' and excluded.device_type <> 'other'
        then excluded.device_type
      else target.device_type
    end,
    operating_system = coalesce(target.operating_system, excluded.operating_system),
    browser = coalesce(target.browser, excluded.browser),
    -- The landing path is where the session STARTED; a later request is by
    -- definition not that, so it never replaces one already recorded.
    landing_path = target.landing_path,
    last_seen_at = now();
end;
$$;

-- Same posture as every other analytics function: the browser never calls it.
revoke execute on function public.ensure_analytics_session(
  uuid, uuid, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.ensure_analytics_session(
  uuid, uuid, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) to service_role;
