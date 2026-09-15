-- Preserve the existing certificate table/design while making the existing
-- student-facing issuance path explicit and owner-scoped.
-- The certificates table is present in the live database and is consumed by
-- app/certificate/[id]/page.js, although its original DDL is not tracked here.

alter table if exists public.certificates enable row level security;

drop policy if exists "certificates_owner_read" on public.certificates;
create policy "certificates_owner_read"
  on public.certificates
  for select
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "certificates_owner_insert" on public.certificates;
create policy "certificates_owner_insert"
  on public.certificates
  for insert
  with check (student_id = auth.uid() or public.is_admin());
