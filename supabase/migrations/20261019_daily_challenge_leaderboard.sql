-- Daily subject challenge: public-safe daily progress and leaderboard metrics.
-- Counts only unique questions actually answered during Africa/Lagos calendar day.
create or replace view public.daily_challenge_scores
with (security_invoker = false) as
with answered as (
  select
    a.user_id,
    q.subject,
    (a.completed_at at time zone 'Africa/Lagos')::date as challenge_date,
    q.id as question_id,
    lower(trim(a.answers ->> q.id::text)) = lower(trim(q.correct_answer)) as is_correct,
    a.completed_at as answered_at
  from public.jamb_practice_attempts a
  cross join lateral unnest(a.question_ids) as submitted(question_id)
  join public.past_questions q on q.id = submitted.question_id
  where a.answers ? q.id::text
),
first_answers as (
  select distinct on (user_id, subject, challenge_date, question_id)
    user_id, subject, challenge_date, question_id, is_correct, answered_at
  from answered
  order by user_id, subject, challenge_date, question_id, answered_at asc
)
select
  user_id,
  subject,
  challenge_date,
  count(*)::integer as questions_attempted,
  count(*) filter (where is_correct)::integer as questions_correct,
  round(100.0 * count(*) filter (where is_correct) / nullif(count(*), 0), 1) as accuracy,
  min(answered_at) as first_attempt_at,
  max(answered_at) as last_attempt_at
from first_answers
group by user_id, subject, challenge_date;

grant select on public.daily_challenge_scores to anon, authenticated;
comment on view public.daily_challenge_scores is
  'Public-safe aggregate scores for the daily challenge. Contains no names, emails, answer payloads, or question content.';

create table if not exists public.daily_challenge_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  challenge_date date not null,
  points_awarded integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, subject, challenge_date)
);
alter table public.daily_challenge_reward_claims enable row level security;
revoke all on public.daily_challenge_reward_claims from anon, authenticated;
grant select on public.daily_challenge_reward_claims to authenticated;
drop policy if exists "Students read own daily challenge reward claims" on public.daily_challenge_reward_claims;
create policy "Students read own daily challenge reward claims"
  on public.daily_challenge_reward_claims for select to authenticated using (auth.uid() = user_id);

create or replace function public.claim_daily_challenge_reward(p_subject text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date := (now() at time zone 'Africa/Lagos')::date;
  v_target integer;
  v_reward integer;
  v_claim_id uuid;
  v_attempted integer;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'message', 'Sign in required.');
  end if;

  case p_subject
    when 'Biology' then v_target := 300; v_reward := 150;
    when 'Physics' then v_target := 300; v_reward := 150;
    when 'Chemistry' then v_target := 200; v_reward := 100;
    when 'CRS' then v_target := 200; v_reward := 100;
    else return jsonb_build_object('success', false, 'message', 'Unknown challenge.');
  end case;

  select s.questions_attempted into v_attempted
  from public.daily_challenge_scores s
  where s.user_id = v_user_id
    and s.subject = p_subject
    and s.challenge_date = v_date;

  if coalesce(v_attempted, 0) < v_target then
    return jsonb_build_object('success', false, 'message', 'Challenge target not reached.');
  end if;

  insert into public.daily_challenge_reward_claims (user_id, subject, challenge_date, points_awarded)
  values (v_user_id, p_subject, v_date, v_reward)
  on conflict (user_id, subject, challenge_date) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    return jsonb_build_object('success', false, 'already_claimed', true, 'message', 'Reward already claimed.');
  end if;

  perform public.add_points(v_user_id, v_reward, 'Completed daily ' || p_subject || ' challenge', 'daily_challenge', v_claim_id);
  return jsonb_build_object('success', true, 'points_awarded', v_reward, 'message', 'Daily challenge reward claimed.');
end;
$$;

revoke all on function public.claim_daily_challenge_reward(text) from public, anon;
grant execute on function public.claim_daily_challenge_reward(text) to authenticated;
