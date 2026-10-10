-- Persistent server-side rate-limit ledger for the authenticated AI tutor.
-- The API route uses the service-role client; students must not read or write this table.
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_user_created
  on public.ai_usage_events (user_id, created_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on table public.ai_usage_events from anon, authenticated;

-- Optional periodic cleanup can remove records older than 30 days once a scheduled
-- cleanup job is configured. The rate limit only counts the previous 60 minutes.
