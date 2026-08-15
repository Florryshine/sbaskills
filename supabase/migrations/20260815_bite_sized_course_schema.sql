-- Bite-sized / micro-learning course system schema.
-- Additive only: preserves existing video, text, PDF, quiz, flashcard,
-- progress, and certificate structures.
--
-- Apply after verifying the live Supabase schema. The repository's checked-in
-- schema is incomplete relative to the live columns already used by the app,
-- so every change below is intentionally idempotent.

-- The live app already uses content_type (video/text/pdf). Add the new format
-- through the existing field rather than introducing a competing format column.
alter table public.lessons
  add column if not exists content_type text;

update public.lessons
set content_type = 'video'
where content_type is null;

alter table public.lessons
  alter column content_type set default 'video';

-- Blueprint and generation state are stored on the lesson because Stage 1 is
-- an inspectable intermediate artifact belonging to one lesson.
alter table public.lessons
  add column if not exists learning_blueprint jsonb,
  add column if not exists generation_status text,
  add column if not exists content_version integer;

update public.lessons
set generation_status = case
  when content_type = 'bite_sized' then coalesce(generation_status, 'draft')
  else coalesce(generation_status, 'not_applicable')
end
where generation_status is null;

update public.lessons
set content_version = coalesce(content_version, 1)
where content_version is null;

alter table public.lessons
  alter column generation_status set default 'not_applicable',
  alter column content_version set default 1;

-- Ordered instructional screens. The question payload remains JSONB in V1 so
-- new interaction shapes do not require a table migration for every type.
create table if not exists public.lesson_screens (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  order_index integer not null,
  type text not null,
  headline text,
  body text,
  image_query text,
  image_url text,
  image_credit text,
  image_alt text,
  question jsonb,
  concept text,
  objective_index integer,
  difficulty text,
  interaction_type text,
  blueprint_refs jsonb not null default '[]'::jsonb,
  required boolean not null default true,
  schema_version integer not null default 1,
  content_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_screens_order_index_check check (order_index >= 0),
  constraint lesson_screens_schema_version_check check (schema_version >= 1),
  constraint lesson_screens_content_version_check check (content_version >= 1),
  unique (lesson_id, order_index)
);

create index if not exists idx_lesson_screens_lesson_order
  on public.lesson_screens(lesson_id, order_index);

create index if not exists idx_lesson_screens_lesson_content_version
  on public.lesson_screens(lesson_id, content_version);

-- Extend the existing single-row lesson progress record with the minimum
-- resume/attempt metadata needed by the screen player. Existing rows remain
-- valid and retain their current completion meaning.
alter table public.lesson_progress
  add column if not exists current_screen_index integer not null default 0,
  add column if not exists started_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists content_version integer not null default 1,
  add column if not exists practice_attempts jsonb not null default '{}'::jsonb;

alter table public.lesson_progress
  drop constraint if exists lesson_progress_current_screen_index_check;

alter table public.lesson_progress
  add constraint lesson_progress_current_screen_index_check
  check (current_screen_index >= 0);

create index if not exists idx_lesson_progress_student_lesson
  on public.lesson_progress(student_id, lesson_id);

-- RLS follows the existing lessons policy: admins can inspect/write all rows;
-- student/public reads are allowed only for published lessons in published
-- courses. New lesson content is never publicly writable.
alter table public.lesson_screens enable row level security;

drop policy if exists "lesson_screens_public_read" on public.lesson_screens;
create policy "lesson_screens_public_read"
  on public.lesson_screens
  for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.lessons
      join public.courses on courses.id = lessons.course_id
      where lessons.id = lesson_screens.lesson_id
        and lessons.is_published = true
        and courses.is_published = true
    )
  );

drop policy if exists "lesson_screens_admin_write" on public.lesson_screens;
create policy "lesson_screens_admin_write"
  on public.lesson_screens
  for all
  using (public.is_admin())
  with check (public.is_admin());

comment on column public.lessons.content_type is
  'Existing lesson format selector. Bite-sized lessons use bite_sized; legacy values include video, text, and pdf.';

comment on column public.lessons.learning_blueprint is
  'Persisted Stage 1 learning blueprint for bite-sized lesson generation; retained for review, analytics, and regeneration.';

comment on column public.lessons.generation_status is
  'Bite-sized generation lifecycle: draft, blueprint_ready, screens_ready, needs_review, published, archived, generation_failed; not_applicable for legacy formats.';

comment on table public.lesson_screens is
  'Ordered interactive instructional screens for bite-sized lessons. This is intentionally named screens, not cards, to remain distinct from flashcards.';

-- Stable storage for administrator-selected instructional images. Supabase
-- Storage is already used by the repository for course and lesson media.
insert into storage.buckets (id, name, public)
values ('lesson-screen-images', 'lesson-screen-images', true)
on conflict (id) do update set public = excluded.public;
