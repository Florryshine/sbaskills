-- Public-safe leaderboard view: expose only id, full_name and streak_days.
-- With security_invoker=true, profiles' self-only RLS hid other students,
-- causing the leaderboard to display the fallback label "Student".
alter view public.leaderboard_profiles set (security_invoker = false);
grant select on public.leaderboard_profiles to anon, authenticated;
