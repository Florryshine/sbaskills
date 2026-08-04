-- 20260730_book_generation_jobs.sql
-- Turns /admin/books/from-text into an async job instead of a request
-- that has to stay open until a (possibly 45-50k word) PDF finishes
-- rendering. The route now creates the book row immediately with
-- generation_status = 'queued' and returns, while the actual
-- parse -> render -> upload -> row-update work happens in the
-- background (see lib/pdf/processBookGeneration.js). The frontend
-- polls GET /api/admin/books/[bookId]/status until it flips to
-- 'ready' or 'failed'.
--
-- Existing rows (all of which already have a pdf_url from the old
-- synchronous flow, or were added manually via /admin/books/new) are
-- backfilled to 'ready' so nothing in the existing admin UI breaks.

alter table public.books
  add column if not exists generation_status text not null default 'ready'
    check (generation_status in ('queued', 'processing', 'ready', 'failed'));

alter table public.books
  add column if not exists generation_error text;

update public.books
  set generation_status = 'ready'
  where generation_status is null;

comment on column public.books.generation_status is
  'queued -> processing -> ready|failed. Set by /api/admin/books/from-text (queued) and lib/pdf/processBookGeneration.js (processing/ready/failed). Pre-existing/manual books default to ready.';

comment on column public.books.generation_error is
  'Error message from the last failed background generation attempt, if any. Null once a regeneration succeeds.';

create index if not exists idx_books_generation_status on public.books(generation_status);
