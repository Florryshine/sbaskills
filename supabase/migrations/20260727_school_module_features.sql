-- 20260727_school_module_features.sql
-- Adds the "New School Features" layer from the School MVP plan:
-- attendance, fee management + reminders tracking, report cards,
-- announcements/notifications, a school gallery, and admission info.
-- Also scopes the existing tutor/teacher dashboard to a school via
-- school_id so a teacher only ever sees their own school's students.
--
-- Everything here is additive (new tables + nullable columns), so it
-- does not touch existing data. Safe to run against the live DB.

-- ---------------------------------------------------------------
-- Schools: admission info (gallery/news get their own tables below
-- so they can hold many items each, rather than being crammed into
-- one text/jsonb column on schools).
-- ---------------------------------------------------------------
alter table public.schools
  add column if not exists admission_info text;

-- Lets a principal assign a teacher to one or more classes (e.g. ['SS1','SS2']).
-- Purely informational/filtering for now -- attendance/report-card/fee
-- routes don't yet enforce it, they just trust school_id + staff role.
alter table public.profiles
  add column if not exists assigned_classes text[] default '{}';

alter table public.schools
  add column if not exists welcome_message text;

-- ---------------------------------------------------------------
-- Gallery
-- ---------------------------------------------------------------
create table if not exists public.school_gallery (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  image_url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_school_gallery_school on public.school_gallery(school_id);

alter table public.school_gallery enable row level security;

drop policy if exists "school_gallery_public_read" on public.school_gallery;
create policy "school_gallery_public_read"
  on public.school_gallery
  for select
  using (true);

drop policy if exists "school_gallery_staff_write" on public.school_gallery;
create policy "school_gallery_staff_write"
  on public.school_gallery
  for all
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()))
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

-- ---------------------------------------------------------------
-- Announcements (covers "News & Announcements" on the landing page
-- AND the Principal's "send notifications" feature -- one table,
-- optionally scoped to an audience and/or a class).
-- ---------------------------------------------------------------
create table if not exists public.school_announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  message text not null,
  audience text not null default 'all' check (audience in ('all', 'students', 'teachers', 'parents')),
  class_level text,
  is_public boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_school_announcements_school on public.school_announcements(school_id, created_at desc);

alter table public.school_announcements enable row level security;

-- Public landing page shows recent public announcements (school "News").
drop policy if exists "school_announcements_public_read" on public.school_announcements;
create policy "school_announcements_public_read"
  on public.school_announcements
  for select
  using (is_public = true or public.is_admin() or (school_id = public.current_school_id()));

drop policy if exists "school_announcements_staff_write" on public.school_announcements;
create policy "school_announcements_staff_write"
  on public.school_announcements
  for insert
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

drop policy if exists "school_announcements_staff_manage" on public.school_announcements;
create policy "school_announcements_staff_manage"
  on public.school_announcements
  for update
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

drop policy if exists "school_announcements_staff_delete" on public.school_announcements;
create policy "school_announcements_staff_delete"
  on public.school_announcements
  for delete
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

-- ---------------------------------------------------------------
-- Attendance
-- One row per student per day. class_level mirrors profiles.student_level
-- (SS1/SS2/SS3 etc.) at the time of marking, so historical records don't
-- shift if a student is promoted later.
-- ---------------------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_level text,
  date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

create index if not exists idx_attendance_school_date on public.attendance_records(school_id, date);
create index if not exists idx_attendance_student on public.attendance_records(student_id);

alter table public.attendance_records enable row level security;

drop policy if exists "attendance_staff_all" on public.attendance_records;
create policy "attendance_staff_all"
  on public.attendance_records
  for all
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()))
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

drop policy if exists "attendance_student_read_own" on public.attendance_records;
create policy "attendance_student_read_own"
  on public.attendance_records
  for select
  using (student_id = auth.uid());

-- ---------------------------------------------------------------
-- Fee management
-- fee_structures: what's owed, defined per school/term/session/class.
-- fee_payments: what's actually been paid, one row per payment.
-- Outstanding balance for a student = matching structure.amount minus
-- sum of their payments tagged to that structure.
-- ---------------------------------------------------------------
create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term text not null,
  session text not null,
  class_level text,
  title text not null default 'School Fees',
  amount numeric(12, 2) not null,
  due_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fee_structures_school on public.fee_structures(school_id, session, term);

alter table public.fee_structures enable row level security;

drop policy if exists "fee_structures_staff_all" on public.fee_structures;
create policy "fee_structures_staff_all"
  on public.fee_structures
  for all
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()))
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

drop policy if exists "fee_structures_student_read" on public.fee_structures;
create policy "fee_structures_student_read"
  on public.fee_structures
  for select
  using (school_id = public.current_school_id());

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  fee_structure_id uuid references public.fee_structures(id) on delete set null,
  amount numeric(12, 2) not null,
  method text default 'cash' check (method in ('cash', 'transfer', 'card', 'other')),
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_fee_payments_school on public.fee_payments(school_id);
create index if not exists idx_fee_payments_student on public.fee_payments(student_id);

alter table public.fee_payments enable row level security;

drop policy if exists "fee_payments_staff_all" on public.fee_payments;
create policy "fee_payments_staff_all"
  on public.fee_payments
  for all
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()))
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

drop policy if exists "fee_payments_student_read_own" on public.fee_payments;
create policy "fee_payments_student_read_own"
  on public.fee_payments
  for select
  using (student_id = auth.uid());

-- fee_reminders: a log of reminders sent/queued, so "send reminders" has
-- something durable to write to and the UI can show reminder history
-- instead of firing silently. Actual delivery (WhatsApp/SMS/email) is
-- left pluggable -- channel + status just record what happened.
create table if not exists public.fee_reminders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  fee_structure_id uuid references public.fee_structures(id) on delete set null,
  channel text not null default 'email' check (channel in ('email', 'sms', 'whatsapp')),
  status text not null default 'sent' check (status in ('sent', 'failed', 'queued')),
  message text,
  sent_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fee_reminders_school on public.fee_reminders(school_id);

alter table public.fee_reminders enable row level security;

drop policy if exists "fee_reminders_staff_all" on public.fee_reminders;
create policy "fee_reminders_staff_all"
  on public.fee_reminders
  for all
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()))
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

-- ---------------------------------------------------------------
-- Report cards
-- subject_scores is jsonb: [{ subject, score, grade, remark }, ...]
-- so it can hold any subject list without a rigid column-per-subject
-- schema, matching how quiz/flashcard content is already stored.
-- ---------------------------------------------------------------
create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  term text not null,
  session text not null,
  class_level text,
  subject_scores jsonb not null default '[]',
  teacher_comment text,
  principal_comment text,
  position_in_class int,
  class_size int,
  attendance_present int,
  attendance_total int,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term, session)
);

create index if not exists idx_report_cards_school on public.report_cards(school_id, session, term);
create index if not exists idx_report_cards_student on public.report_cards(student_id);

alter table public.report_cards enable row level security;

drop policy if exists "report_cards_staff_all" on public.report_cards;
create policy "report_cards_staff_all"
  on public.report_cards
  for all
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()))
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

drop policy if exists "report_cards_student_read_own" on public.report_cards;
create policy "report_cards_student_read_own"
  on public.report_cards
  for select
  using (student_id = auth.uid());

-- ---------------------------------------------------------------
-- Demo data
-- Attaches a batch of realistic-looking demo students, a teacher, fee
-- structure, attendance, and an announcement to the existing
-- 'demo-school' row (seeded in 20260727_schools.sql) so the whole
-- School Module can be clicked through end-to-end with no real school
-- signed up yet. All demo rows are easy to spot: emails end in
-- @demo.sba and full_name is prefixed with nothing special, but
-- they're real profile rows (unlike the principal dashboard's old
-- client-side "Demo Mode" fake data, which stays as a UI-only fallback
-- when a school truly has zero students).
-- ---------------------------------------------------------------
do $$
declare
  v_school_id uuid;
  v_fee_id uuid;
  v_student record;
  v_names text[] := array[
    'Chidera Okafor', 'Amina Bello', 'Emeka Nwosu', 'Grace Adeyemi',
    'Ibrahim Suleiman', 'Ngozi Eze', 'Tunde Bakare', 'Fatima Yusuf',
    'David Okonkwo', 'Blessing Umeh', 'Samuel Adigun', 'Halima Musa'
  ];
  v_levels text[] := array['SS1', 'SS2', 'SS3'];
  i int;
  v_id uuid;
begin
  select id into v_school_id from public.schools where slug = 'demo-school';
  if v_school_id is null then
    return;
  end if;

  update public.schools
  set
    admission_info = coalesce(admission_info,
      'Admissions for the new session are open. Interested parents should contact the school office with the student''s last report card and birth certificate.'),
    welcome_message = coalesce(welcome_message,
      'Welcome to our school''s digital home. We''re proud to give every one of our students free access to the Shiney Brain learning platform alongside the classroom teaching they already receive here.')
  where id = v_school_id;

  insert into public.school_gallery (school_id, image_url, caption, sort_order)
  values
    (v_school_id, 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800', 'Main school block', 1),
    (v_school_id, 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800', 'Students in the science lab', 2),
    (v_school_id, 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800', 'Inter-house sports day', 3)
  on conflict do nothing;

  insert into public.school_announcements (school_id, title, message, audience, is_public)
  values
    (v_school_id, 'Second Term Resumption', 'School resumes for the second term on Monday. Students should come with their updated textbooks.', 'all', true),
    (v_school_id, 'PTA Meeting', 'There will be a PTA meeting this Saturday at 10am in the main hall.', 'parents', true)
  on conflict do nothing;

  -- Demo teacher (only created if it doesn't already exist).
  if not exists (select 1 from public.profiles where email = 'teacher@demo.sba') then
    insert into public.profiles (id, email, full_name, role, school_id, is_teaching, is_active)
    values (gen_random_uuid(), 'teacher@demo.sba', 'Mrs. Patricia Amadi', 'teacher', v_school_id, true, true);
  end if;

  insert into public.fee_structures (school_id, term, session, class_level, title, amount, due_date)
  values (v_school_id, 'First Term', '2025/2026', null, 'Tuition & Development Levy', 45000, current_date + interval '14 days')
  on conflict do nothing
  returning id into v_fee_id;

  if v_fee_id is null then
    select id into v_fee_id from public.fee_structures
    where school_id = v_school_id and term = 'First Term' and session = '2025/2026'
    limit 1;
  end if;

  for i in 1..8 loop
    v_id := gen_random_uuid();
    if not exists (select 1 from public.profiles where email = 'demostudent' || i || '@demo.sba') then
      insert into public.profiles (id, email, full_name, role, school_id, student_level, is_active)
      values (
        v_id,
        'demostudent' || i || '@demo.sba',
        v_names[1 + ((i - 1) % array_length(v_names, 1))],
        'student',
        v_school_id,
        v_levels[1 + ((i - 1) % array_length(v_levels, 1))],
        true
      );

      insert into public.attendance_records (school_id, student_id, class_level, date, status)
      values (v_school_id, v_id, v_levels[1 + ((i - 1) % array_length(v_levels, 1))], current_date, case when i % 5 = 0 then 'absent' else 'present' end)
      on conflict do nothing;

      if v_fee_id is not null and i % 2 = 0 then
        insert into public.fee_payments (school_id, student_id, fee_structure_id, amount, method, note)
        values (v_school_id, v_id, v_fee_id, 25000, 'transfer', 'Part payment (demo data)');
      end if;

      insert into public.report_cards (school_id, student_id, term, session, class_level, subject_scores, teacher_comment, position_in_class, class_size, attendance_present, attendance_total)
      values (
        v_school_id, v_id, 'First Term', '2025/2026',
        v_levels[1 + ((i - 1) % array_length(v_levels, 1))],
        jsonb_build_array(
          jsonb_build_object('subject', 'Mathematics', 'score', 60 + (i * 3) % 40, 'grade', 'B2', 'remark', 'Good'),
          jsonb_build_object('subject', 'English Language', 'score', 55 + (i * 5) % 40, 'grade', 'B3', 'remark', 'Good'),
          jsonb_build_object('subject', 'Biology', 'score', 50 + (i * 7) % 40, 'grade', 'C4', 'remark', 'Fair')
        ),
        'A steady, hardworking student this term.',
        i, 8, 55 - i, 60
      )
      on conflict (student_id, term, session) do nothing;
    end if;
  end loop;
end $$;
