-- Run this in the Supabase SQL editor before deploying the book-payment fix.
-- Mirrors the existing `enrollments` table, but for paid book downloads.

create table if not exists book_purchases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) not null,
  book_id uuid references books(id) not null,
  payment_reference text,
  amount_paid numeric,
  status text default 'active',
  payment_type text default 'paystack',
  created_at timestamptz default now(),
  unique (student_id, book_id)
);

-- Optional but recommended: let students read only their own purchases.
alter table book_purchases enable row level security;

create policy "Students can view their own book purchases"
  on book_purchases for select
  using (auth.uid() = student_id);
