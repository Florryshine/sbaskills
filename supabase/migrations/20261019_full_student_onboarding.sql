-- Expand student onboarding and profile data. Additive only; existing profile rows remain intact.
alter table public.profiles
  add column if not exists age_group text,
  add column if not exists target_score integer,
  add column if not exists previous_jamb_score integer,
  add column if not exists jamb_attempts integer,
  add column if not exists target_course text,
  add column if not exists preferred_institution text,
  add column if not exists utme_subjects text[] not null default array['English']::text[],
  add column if not exists weak_subjects text[] not null default '{}'::text[],
  add column if not exists study_time text,
  add column if not exists study_challenges text,
  add column if not exists device_access text,
  add column if not exists internet_access text,
  add column if not exists support_needs text[] not null default '{}'::text[],
  add column if not exists referral_source text;

alter table public.profiles
  drop constraint if exists profiles_target_score_range,
  add constraint profiles_target_score_range check (target_score is null or (target_score between 0 and 400)),
  drop constraint if exists profiles_previous_jamb_score_range,
  add constraint profiles_previous_jamb_score_range check (previous_jamb_score is null or (previous_jamb_score between 0 and 400)),
  drop constraint if exists profiles_jamb_attempts_range,
  add constraint profiles_jamb_attempts_range check (jamb_attempts is null or (jamb_attempts between 0 and 4));
