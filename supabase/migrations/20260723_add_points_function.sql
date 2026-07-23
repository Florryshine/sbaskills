-- 20260723_add_points_function.sql
-- Safe to run multiple times. Run in Supabase SQL editor.
--
-- lib/gamification.js's addPoints() calls supabase.rpc('add_points', ...)
-- on essentially every rewarded action across the platform (daily login,
-- quiz completion, boss battles, tutor bonuses, referrals) — but no
-- add_points function existed anywhere in the tracked migrations. Every
-- one of those calls was failing silently (the error is caught and only
-- console.error'd, never surfaced to the student), so points were never
-- actually being awarded. This is the root cause of "points not working."
--
-- update_streak() (see 003_progression_system.sql) is correctly defined
-- and does exist — if streak still isn't behaving as expected after this
-- runs, the most likely explanation is that 003_progression_system.sql
-- itself was never actually executed against this Supabase project (the
-- same "written in the repo but never run" gap past_questions had), in
-- which case run that migration too, in order, before this one.

-- user_points and points_log are both referenced across the app
-- (leaderboard, boss, dashboard, mastery pillars) but neither has a
-- CREATE TABLE anywhere in the tracked migrations either -- same gap as
-- past_questions and add_points. Creating them here so add_points has
-- something real to write to, without touching any data if they already
-- exist by hand in the dashboard.
create table if not exists public.user_points (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_points integer not null default 0,
  redeemed_points integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.points_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null,
  reason text,
  action_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists points_log_user_idx on public.points_log (user_id);

alter table public.user_points enable row level security;
alter table public.points_log enable row level security;

-- app/leaderboard/page.js reads total_points across ALL users (no
-- .eq(user_id) filter) to build the public leaderboard, so this needs
-- to be broadly readable, not just own-row.
drop policy if exists "Anyone can view points for leaderboard" on public.user_points;
create policy "Anyone can view points for leaderboard"
  on public.user_points for select
  to authenticated
  using (true);

-- points_log is a personal activity log (used by lib/mastery.js to
-- compute a user's own mastery-pillar counts) -- no evidence anywhere
-- in the app that another user's log needs to be visible, so this stays
-- own-row-only, matching the pattern used for redemptions in
-- 003_progression_system.sql.
drop policy if exists "Users can view own points log" on public.points_log;
create policy "Users can view own points log"
  on public.points_log for select
  to authenticated
  using (auth.uid() = user_id);

-- add_points itself: increments (or creates) the user's total_points and
-- records the reason in points_log, mirroring exactly what
-- addPoints(userId, points, reason, actionType, referenceId) in
-- lib/gamification.js already sends. security definer so it can write
-- regardless of which policies exist above, same pattern as
-- update_streak and redeem_points already use.
create or replace function add_points(
  p_user_id uuid,
  p_points integer,
  p_reason text,
  p_action_type text,
  p_reference_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_points (user_id, total_points)
  values (p_user_id, greatest(p_points, 0))
  on conflict (user_id) do update
    set total_points = public.user_points.total_points + p_points,
        updated_at = now();

  insert into public.points_log (user_id, points, reason, action_type, reference_id)
  values (p_user_id, p_points, p_reason, p_action_type, p_reference_id);
end;
$$;

grant execute on function add_points(uuid, integer, text, text, uuid) to authenticated;
