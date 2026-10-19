-- Allow authenticated students to read published flashcard sets.
-- The previous public_read_published_flashcards policy only targeted anon.
-- Signed-in students use the authenticated Postgres role, so the detail query
-- returned no rows and incorrectly reported "not found or not published".
drop policy if exists public_read_published_flashcards on public.flashcard_drafts;
create policy public_read_published_flashcards
  on public.flashcard_drafts
  for select
  to anon, authenticated
  using (status = 'published');
