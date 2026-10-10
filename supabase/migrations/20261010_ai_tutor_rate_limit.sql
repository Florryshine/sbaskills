-- Database-backed per-user rate limit for the authenticated AI tutor.
-- Run this migration in Supabase before relying on the chat endpoint change.
create table if not exists public.ai_request_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.ai_request_limits enable row level security;
revoke all on table public.ai_request_limits from anon, authenticated;

create or replace function public.consume_ai_request_limit(
  p_user_id uuid,
  p_limit integer default 20,
  p_window_minutes integer default 60
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return false;
  end if;
  if p_limit < 1 or p_window_minutes < 1 then
    return false;
  end if;

  insert into public.ai_request_limits (user_id, window_started_at, request_count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
  set window_started_at = case
        when public.ai_request_limits.window_started_at <= now() - make_interval(mins => p_window_minutes) then now()
        else public.ai_request_limits.window_started_at
      end,
      request_count = case
        when public.ai_request_limits.window_started_at <= now() - make_interval(mins => p_window_minutes) then 1
        else public.ai_request_limits.request_count + 1
      end
  where public.ai_request_limits.window_started_at <= now() - make_interval(mins => p_window_minutes)
     or public.ai_request_limits.request_count < p_limit
  returning true into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.consume_ai_request_limit(uuid, integer, integer) from public;
grant execute on function public.consume_ai_request_limit(uuid, integer, integer) to authenticated;

-- Periodically remove expired counters (safe to run manually or from a scheduled job).
create index if not exists ai_request_limits_window_started_at_idx
  on public.ai_request_limits (window_started_at);