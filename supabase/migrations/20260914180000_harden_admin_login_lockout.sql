-- Bang Private Tattoos: harden the admin PIN lockout.
-- Function-only change: no tables, columns, policies, or rows are altered.
--
-- 1. record_admin_login_failure raised failed_attempts to 6 once a lock had expired, violating the
--    0..5 check constraint. Every later failure then errored, so the lockout was never re-applied.
--    An expired lock now starts a fresh window of five attempts.
-- 2. reserve_admin_login_attempt counts an attempt atomically before the PIN is checked, so
--    concurrent requests from one source cannot evaluate more than five PINs per lock window.

create or replace function public.record_admin_login_failure(p_source_hash text)
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
      when public.admin_login_lockouts.locked_until > now() then public.admin_login_lockouts.failed_attempts
      when public.admin_login_lockouts.locked_until is not null then 1
      else least(public.admin_login_lockouts.failed_attempts + 1, 5)
    end,
    last_failed_at = now(),
    locked_until = case
      when public.admin_login_lockouts.locked_until > now() then public.admin_login_lockouts.locked_until
      when public.admin_login_lockouts.locked_until is null and public.admin_login_lockouts.failed_attempts + 1 >= 5 then now() + interval '30 minutes'
      else null
    end,
    updated_at = now()
  returning admin_login_lockouts.failed_attempts, admin_login_lockouts.locked_until into next_attempts, next_lock;
  return query select greatest(0, 5 - next_attempts), next_lock;
end;
$$;

create function public.reserve_admin_login_attempt(p_source_hash text)
returns table (allowed boolean, attempts_remaining integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  previous public.admin_login_lockouts%rowtype;
  next_attempts integer;
  next_lock timestamptz;
begin
  -- Create the row if needed, then lock it so concurrent attempts from one source are counted serially.
  insert into public.admin_login_lockouts (source_hash) values (p_source_hash)
  on conflict (source_hash) do nothing;
  select * into previous from public.admin_login_lockouts where source_hash = p_source_hash for update;

  if previous.locked_until > now() then
    return query select false, 0, previous.locked_until;
    return;
  end if;

  -- An expired lock starts a fresh window of five attempts.
  next_attempts := case when previous.locked_until is not null then 1 else least(coalesce(previous.failed_attempts, 0) + 1, 5) end;
  next_lock := case when next_attempts >= 5 then now() + interval '30 minutes' else null end;

  insert into public.admin_login_lockouts (source_hash, failed_attempts, last_failed_at, locked_until, updated_at)
  values (p_source_hash, next_attempts, now(), next_lock, now())
  on conflict (source_hash) do update
    set failed_attempts = excluded.failed_attempts,
        last_failed_at = excluded.last_failed_at,
        locked_until = excluded.locked_until,
        updated_at = excluded.updated_at;

  return query select true, 5 - next_attempts, next_lock;
end;
$$;

revoke all on function public.record_admin_login_failure(text), public.reserve_admin_login_attempt(text) from public, anon, authenticated;
grant execute on function public.record_admin_login_failure(text), public.reserve_admin_login_attempt(text) to service_role;
