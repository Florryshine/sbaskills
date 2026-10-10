-- Read-only audit: run in Supabase SQL Editor and inspect every public table.
-- This does not change policies or data.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  coalesce(p.policy_count, 0) as policy_count,
  coalesce(g.role_grants, '') as anon_authenticated_grants
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select schemaname, tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
  group by schemaname, tablename
) p on p.schemaname = n.nspname and p.tablename = c.relname
left join lateral (
  select string_agg(distinct grantee || ':' || privilege_type, ', ' order by grantee || ':' || privilege_type) as role_grants
  from information_schema.role_table_grants r
  where r.table_schema = n.nspname
    and r.table_name = c.relname
    and r.grantee in ('anon', 'authenticated')
) g on true
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity asc, coalesce(p.policy_count, 0) asc, c.relname;

-- Review policies and their expressions in detail:
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;