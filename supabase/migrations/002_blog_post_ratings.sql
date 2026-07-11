-- ─── Blog post ratings ──────────────────────────────────────────────────
-- Backs the reader rating widget on each blog post. This is what makes the
-- AggregateRating structured data on blog posts genuine instead of fake:
-- Google requires that schema to reflect real user ratings, so we only ever
-- read the average/count from here — nothing is hardcoded.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New
-- query → paste → Run). Safe to re-run: every statement is idempotent.

create table if not exists public.blog_post_ratings (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.content_drafts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists blog_post_ratings_post_id_idx
  on public.blog_post_ratings (post_id);

-- One rating per logged-in user per post. Anonymous votes (user_id null)
-- aren't deduped at the database level — the rating widget itself guards
-- against repeat votes from the same browser via localStorage.
create unique index if not exists blog_post_ratings_unique_user_post
  on public.blog_post_ratings (post_id, user_id)
  where user_id is not null;

alter table public.blog_post_ratings enable row level security;

drop policy if exists "Anyone can read ratings" on public.blog_post_ratings;
create policy "Anyone can read ratings"
  on public.blog_post_ratings for select
  using (true);

drop policy if exists "Anyone can submit a rating" on public.blog_post_ratings;
create policy "Anyone can submit a rating"
  on public.blog_post_ratings for insert
  with check (rating between 1 and 5);

-- No update/delete policy on purpose — once cast, a rating is immutable.
-- This keeps the aggregate honest and avoids a route for tampering with
-- past votes.
