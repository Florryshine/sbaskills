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
