-- User-selected target durations for Cartoon and Whiteboard AI lesson generation.
alter table public.cartoon_projects
  add column if not exists target_duration_seconds integer not null default 120
  check (target_duration_seconds in (30,60,120,180,300,480,600));

alter table public.whiteboard_jobs
  add column if not exists target_duration_seconds integer not null default 120
  check (target_duration_seconds in (30,60,120,180,300,480,600));
