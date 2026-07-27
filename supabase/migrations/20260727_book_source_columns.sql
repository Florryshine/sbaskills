-- 20260727_book_source_columns.sql
-- Supports the "paste text -> branded PDF" book generator
-- (app/admin/books/from-text). Keeps the original markdown and chosen
-- template alongside the generated PDF, so a book can be reopened,
-- edited, and regenerated later instead of the source being thrown away
-- the moment the PDF is created.
--
-- Both columns nullable — books created via the existing manual
-- /admin/books/new form (with no source markdown) are unaffected.

alter table public.books
  add column if not exists source_markdown text;

alter table public.books
  add column if not exists template text;

comment on column public.books.source_markdown is
  'Original pasted markdown used to generate pdf_url via /admin/books/from-text. Null for manually-added books.';

comment on column public.books.template is
  'Theme key used at generation time (brand, modern, workbook, premium, minimal, dark). Null for manually-added books.';
