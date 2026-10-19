-- Student onboarding contact and headshot fields.
-- Additive migration: existing profiles remain valid and testimonial consent defaults to opt-out.
alter table public.profiles
  add column if not exists guardian_phone text,
  add column if not exists avatar_url text,
  add column if not exists avatar_public_id text,
  add column if not exists testimonial_consent boolean not null default false;
