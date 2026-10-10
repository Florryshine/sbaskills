-- Read-only database security audit. Run in the production Supabase SQL Editor.
-- This identifies exposed public-schema tables that lack RLS or have no policies.

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.polname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
group by n.nspname, c.relname, c.relrowsecurity
having c.relrowsecurity = false or count(p.polname) = 0
order by c.relrowsecurity, policy_count, c.relname;

-- Inspect policies on tables that do have RLS. Review policy commands and expressions;
-- RLS enabled with a permissive policy can still be unsafe.
select
  schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Verify private library storage and the new AI rate-limit table.
select id, name, public as bucket_is_public
from storage.buckets
where id = 'books';

select to_regclass('public.ai_usage_events') as ai_usage_events_table;
