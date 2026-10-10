-- Protect library PDFs from direct public-URL access.
-- The download API verifies purchase access and returns a short-lived signed URL.
-- Run this migration in the production Supabase project before relying on the gate.
update storage.buckets
set public = false
where id = 'books';

-- Verify after applying:
-- select id, name, public from storage.buckets where id = 'books';
-- Expected: public = false.
