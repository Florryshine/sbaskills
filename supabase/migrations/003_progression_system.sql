-- 003_progression_system.sql
-- Safe to run multiple times. Run in Supabase SQL editor.
-- Covers: canonical streak, spendable points ledger, exam_type personalization,
-- badges wiring, and mastery-pillar source data.

-- 1) STREAK: profiles.streak_days becomes the single source of truth.
alter table public.profiles add column if not exists streak_days integer not null default 0;
alter table public.profiles add column if not exists last_active date;

-- Backfill from whichever table currently has the higher value, so nobody's streak resets to 0.
update public.profiles p
set streak_days = greatest(p.streak_days, coalesce(up.streak_days, 0))
from public.user_points up
where up.user_id = p.id;

-- Canonical streak function: profiles is now the only writer.
create or replace function update_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_date date;
begin
  select last_active into v_last_date from public.profiles where id = p_user_id;

  update public.profiles
  set streak_days = case
        when last_active = current_date then streak_days
        when last_active = current_date - 1 then streak_days + 1
        else 1
      end,
      last_active = current_date
  where id = p_user_id;
end;
$$;

grant execute on function update_streak(uuid) to authenticated;

-- 2) SPENDABLE POINTS: total_points stays lifetime/never-decreasing (it drives levels).
-- Spending is tracked separately so level progress is never touched by redemptions.
alter table public.user_points add column if not exists redeemed_points integer not null default 0;

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cost_points integer not null check (cost_points > 0),
  reward_type text not null default 'digital',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.rewards(id),
  cost_points integer not null,
  status text not null default 'fulfilled' check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at timestamptz default now()
);

alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;

drop policy if exists "Anyone can view active rewards" on public.rewards;
create policy "Anyone can view active rewards" on public.rewards for select to authenticated using (is_active = true);

drop policy if exists "Users can view own redemptions" on public.redemptions;
create policy "Users can view own redemptions" on public.redemptions for select to authenticated using (auth.uid() = user_id);

create or replace function redeem_points(p_user_id uuid, p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer;
  v_available integer;
  v_active boolean;
begin
  select cost_points, is_active into v_cost, v_active from public.rewards where id = p_reward_id;

  if v_cost is null then
    return jsonb_build_object('success', false, 'message', 'Reward not found');
  end if;
  if not v_active then
    return jsonb_build_object('success', false, 'message', 'Reward is no longer available');
  end if;

  select (total_points - redeemed_points) into v_available from public.user_points where user_id = p_user_id;
  v_available := coalesce(v_available, 0);

  if v_available < v_cost then
    return jsonb_build_object('success', false, 'message', 'Not enough points', 'available', v_available, 'cost', v_cost);
  end if;

  update public.user_points set redeemed_points = redeemed_points + v_cost, updated_at = now() where user_id = p_user_id;

  insert into public.redemptions (user_id, reward_id, cost_points) values (p_user_id, p_reward_id, v_cost);

  insert into public.points_log (user_id, points, reason, action_type, reference_id)
  values (p_user_id, -v_cost, 'Redeemed reward', 'redemption', p_reward_id);

  return jsonb_build_object('success', true, 'remaining', v_available - v_cost);
end;
$$;

grant execute on function redeem_points(uuid, uuid) to authenticated;

-- Seed a starter set of rewards so the store isn't empty on launch.
insert into public.rewards (title, description, cost_points, reward_type)
select * from (values
  ('Boss Battle Extra Hint', 'Reveal one hint during any boss battle attempt.', 50, 'digital'),
  ('Extra Quiz Attempt', 'Unlock one additional attempt on a completed quiz.', 75, 'digital'),
  ('SBA Profile Frame', 'A special profile frame shown on the leaderboard.', 150, 'cosmetic'),
  ('Premium Study Pack Unlock', 'Unlock one premium revision pack for 7 days.', 400, 'academic')
) as v(title, description, cost_points, reward_type)
where not exists (select 1 from public.rewards);

-- 3) EXAM-TYPE PERSONALIZATION: same content, labeled per the student's exam track.
-- Onboarding already collects this into profiles.target_exams (text[]) —
-- no new column needed, just a read helper (see lib/examLabel.js).

-- 4) MASTERY PILLARS / BADGES source data (levels are computed in app code from these).
-- points_log.action_type already distinguishes 'quiz', 'boss_battle', 'tutor_bonus', etc.,
-- and student_progress already distinguishes activity_type, so no new tables are needed
-- for Learning Mastery / Assessment Champion / Scholar Recognition — just queries.
-- user_achievements already exists per prior audit; the bug was that nothing
-- ever wrote to it. Fix is in application code (lib/badges.js). Adding
-- requirement columns here so auto-award has something to evaluate against —
-- existing manually-curated achievement rows are untouched (requirement_type
-- stays null on those, so they're simply skipped by auto-award, not broken).
alter table public.achievements add column if not exists requirement_type text
  check (requirement_type in ('streak', 'xp', 'learning_mastery', 'assessment_champion', 'scholar_recognition') or requirement_type is null);
alter table public.achievements add column if not exists requirement_value integer;

-- 5) leaderboard_profiles view now also exposes canonical streak_days,
-- since the leaderboard previously read the stale user_points copy.
-- (Appending a column at the end is safe for CREATE OR REPLACE VIEW.)
create or replace view public.leaderboard_profiles as
select id, full_name, streak_days
from public.profiles;
