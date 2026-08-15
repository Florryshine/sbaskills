-- Persist deterministic validation diagnostics for admin review.
alter table public.lessons
  add column if not exists generation_diagnostics jsonb not null default '[]'::jsonb;

comment on column public.lessons.generation_diagnostics is
  'Structured validator diagnostics for bite-sized lesson blueprint/screen generation; errors block publishing and warnings require review.';
