-- Durable curriculum processing and explicit curriculum-to-knowledge relationships.
-- Keep knowledge_assets.keyword and existing keyword workflows unchanged.

create table if not exists public.curriculum_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.curriculum_source_documents(id) on delete cascade,
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  subject text not null,
  status text not null default 'queued'
    check (status in ('queued','processing','partially_completed','completed','failed')),
  chunks jsonb not null default '[]'::jsonb,
  next_chunk_index integer not null default 0,
  total_chunks integer not null default 0,
  attempts jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{"topics_added":0,"topics_already_existing":0,"objectives_added":0,"assets_created":0,"assets_linked":0}'::jsonb,
  last_error text,
  locked_until timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_curriculum_processing_jobs_queue
  on public.curriculum_processing_jobs(status, created_at)
  where status in ('queued','processing','partially_completed');

create unique index if not exists idx_curriculum_processing_jobs_one_active_per_document
  on public.curriculum_processing_jobs(document_id)
  where status in ('queued','processing','partially_completed');

alter table public.curriculum_processing_jobs enable row level security;

drop policy if exists "Admins read curriculum processing jobs" on public.curriculum_processing_jobs;
create policy "Admins read curriculum processing jobs"
  on public.curriculum_processing_jobs for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- This bridge is the forward-compatible many-to-many link. The legacy
-- knowledge_assets.curriculum_topic_id FK points to a legacy table and must
-- not be populated with IDs from the new curriculum_topics table.
create table if not exists public.curriculum_topic_assets (
  curriculum_topic_id uuid not null references public.curriculum_topics(id) on delete cascade,
  knowledge_asset_id uuid not null references public.knowledge_assets(id) on delete cascade,
  relationship text not null default 'primary'
    check (relationship in ('primary','supporting','prerequisite','related')),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (curriculum_topic_id, knowledge_asset_id)
);

create index if not exists idx_curriculum_topic_assets_asset
  on public.curriculum_topic_assets(knowledge_asset_id);

alter table public.curriculum_topic_assets enable row level security;

drop policy if exists "Authenticated users read curriculum topic assets" on public.curriculum_topic_assets;
create policy "Authenticated users read curriculum topic assets"
  on public.curriculum_topic_assets for select to authenticated using (true);

drop policy if exists "Admins manage curriculum topic assets" on public.curriculum_topic_assets;
create policy "Admins manage curriculum topic assets"
  on public.curriculum_topic_assets for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Atomic job claiming: multiple scheduled worker invocations cannot claim the same job.
create or replace function public.claim_curriculum_processing_job()
returns setof public.curriculum_processing_jobs
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id
    from public.curriculum_processing_jobs
    where status in ('queued','processing','partially_completed')
      and (locked_until is null or locked_until < now())
      and next_chunk_index < total_chunks
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.curriculum_processing_jobs j
  set status = 'processing',
      locked_until = now() + interval '90 seconds',
      started_at = coalesce(started_at, now()),
      updated_at = now()
  from candidate c
  where j.id = c.id
  returning j.*;
end;
$$;

revoke all on function public.claim_curriculum_processing_job() from public, anon, authenticated;
grant execute on function public.claim_curriculum_processing_job() to service_role;

-- Expose only what the RLS policies permit.
grant select on public.curriculum_processing_jobs to authenticated;
grant all on public.curriculum_processing_jobs to service_role;
grant select, insert, update, delete on public.curriculum_topic_assets to authenticated;
grant all on public.curriculum_topic_assets to service_role;

-- Preserve existing direct links in the new bridge table.
insert into public.curriculum_topic_assets (curriculum_topic_id, knowledge_asset_id, relationship, source)
select t.id, t.knowledge_asset_id, 'primary', 'existing_curriculum_link'
from public.curriculum_topics t
where t.knowledge_asset_id is not null
on conflict (curriculum_topic_id, knowledge_asset_id) do nothing;

-- Backfill exact title/subject matches only; do not manufacture placeholder assets
-- for existing topics that have no meaningful knowledge content yet.
with candidates as (
  select t.id as topic_id, a.id as asset_id,
         row_number() over (
           partition by t.id
           order by case a.topic_type when 'learning' then 0 when 'curriculum_topic' then 1 else 2 end,
                    a.updated_at desc nulls last
         ) as rn
  from public.curriculum_topics t
  join public.knowledge_assets a
    on lower(trim(a.keyword)) = lower(trim(t.title))
   and lower(trim(coalesce(a.subject,''))) = lower(trim(coalesce(t.subject,'')))
  where t.knowledge_asset_id is null
)
insert into public.curriculum_topic_assets (curriculum_topic_id, knowledge_asset_id, relationship, source)
select topic_id, asset_id, 'primary', 'exact_title_subject_backfill'
from candidates where rn = 1
on conflict (curriculum_topic_id, knowledge_asset_id) do nothing;
