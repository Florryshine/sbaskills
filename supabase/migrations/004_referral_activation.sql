-- 004_referral_activation.sql
-- Run in Supabase SQL editor. Safe to run multiple times.
-- Activates the previously-dormant referral system: captures ?ref= at
-- signup, but only pays out once the referred student actually completes
-- their first learning activity (anti-abuse — not raw signup).

alter table public.profiles add column if not exists referred_by uuid references public.profiles(id);
alter table public.profiles add column if not exists referral_rewarded boolean not null default false;
