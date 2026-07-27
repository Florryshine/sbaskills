-- 20260726_feature_unlock_levels.sql
-- XP Unlock System - Custom unlock levels configuration
-- Allows admin to modify which level features unlock at

-- Create table for custom unlock levels
create table if not exists public.feature_unlock_levels (
  id uuid primary key default gen_random_uuid(),
  feature_id text not null unique,
  feature_name text not null,
  unlock_level integer not null check (unlock_level >= 1),
  description text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.feature_unlock_levels enable row level security;

-- Policies for feature_unlock_levels
-- Admin can manage all
create policy "Admin can manage feature unlock levels" on public.feature_unlock_levels
  for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Anyone can read active configurations
create policy "Anyone can read active feature unlock levels" on public.feature_unlock_levels
  for select to authenticated using (is_active = true);

-- Create a function to update the updated_at timestamp
create or replace function update_feature_unlock_level_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
create trigger update_feature_unlock_level_timestamp_trigger
  before update on public.feature_unlock_levels
  for each row execute function update_feature_unlock_level_timestamp();

-- Seed default unlock levels
insert into public.feature_unlock_levels (feature_id, feature_name, unlock_level, description)
select * from (values
  ('lessons', 'Lessons', 1, 'Access course lessons and study materials'),
  ('quiz', 'Quiz', 1, 'Take quizzes to test your knowledge'),
  ('dailyChallenge', 'Daily Challenge', 1, 'Complete daily challenges for bonus XP'),
  ('flashcards', 'Flashcards', 5, 'Study with interactive flashcards'),
  ('podcasts', 'Podcasts', 10, 'Listen to educational podcasts'),
  ('bossBattle', 'Boss Battle', 15, 'Challenge AI bosses to test your skills'),
  ('discussionForum', 'Discussion Forum', 20, 'Join discussions with other students'),
  ('mockCBT', 'Mock CBT', 30, 'Practice with computer-based test simulations'),
  ('aiMentor', 'AI Mentor', 40, 'Get personalized guidance from AI mentors')
) as v(feature_id, feature_name, unlock_level, description)
where not exists (select 1 from public.feature_unlock_levels where feature_id = v.feature_id);

-- Create a view for easy access to unlock information
create or replace view public.feature_unlock_info as
select 
  f.feature_id,
  f.feature_name,
  f.unlock_level,
  f.description,
  f.is_active,
  l.level as level_name
from public.feature_unlock_levels f
left join public.levels l on f.unlock_level = l.level;
