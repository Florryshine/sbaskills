-- Knowledge Asset reusable content library.
create table if not exists public.ka_components (
  id uuid primary key default gen_random_uuid(),
  knowledge_asset_id uuid not null references public.knowledge_assets(id) on delete cascade,
  component_type text not null,
  variant text not null default '',
  version integer not null default 1,
  status text not null default 'generating' check (status in ('generating','ready','failed','superseded')),
  source_hash text not null,
  prompt_version text not null,
  parents jsonb not null default '[]'::jsonb,
  body jsonb,
  storage_path text,
  mime_type text,
  bytes bigint,
  duration_ms integer,
  generated_by text,
  attempts integer not null default 0,
  last_error text,
  locked_until timestamptz,
  claim_token uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ka_components_one_live_version
  on public.ka_components (knowledge_asset_id, component_type, variant)
  where status <> 'superseded';
create index if not exists ka_components_asset_type_created
  on public.ka_components (knowledge_asset_id, component_type, created_at desc);
create index if not exists ka_components_status_lock
  on public.ka_components (status, locked_until) where status = 'generating';

create table if not exists public.ka_component_uses (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.ka_components(id) on delete cascade,
  consumer_type text not null,
  consumer_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists ka_component_uses_component on public.ka_component_uses (component_id, created_at desc);
create index if not exists ka_component_uses_consumer on public.ka_component_uses (consumer_type, consumer_id);

alter table public.ka_components enable row level security;
alter table public.ka_component_uses enable row level security;
drop policy if exists "service role full access" on public.ka_components;
create policy "service role full access" on public.ka_components for all to service_role using (true) with check (true);
drop policy if exists "service role full access" on public.ka_component_uses;
create policy "service role full access" on public.ka_component_uses for all to service_role using (true) with check (true);
revoke all on table public.ka_components, public.ka_component_uses from anon, authenticated;
grant all on table public.ka_components, public.ka_component_uses to service_role;

-- Serialize claims per Knowledge Asset/component/variant and issue a lease token.
-- The lease token prevents a worker whose five-minute lease expired from saving
-- over a newer worker that reclaimed the component.
create or replace function public.claim_ka_component(
  p_asset_id uuid, p_component_type text, p_variant text,
  p_source_hash text, p_prompt_version text, p_created_by uuid, p_force boolean
)
returns table(component_id uuid, should_generate boolean, component_status text, component_body jsonb, component_version integer, claim_token uuid)
language plpgsql security invoker set search_path = public
as $$
declare
  existing public.ka_components%rowtype;
  next_version integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_asset_id::text || ':' || p_component_type || ':' || coalesce(p_variant, ''), 0
  ));

  select * into existing
  from public.ka_components
  where knowledge_asset_id = p_asset_id
    and component_type = p_component_type
    and variant = coalesce(p_variant, '')
    and status <> 'superseded'
  order by version desc limit 1 for update;

  if found and not coalesce(p_force, false) then
    if existing.status = 'ready'
       and existing.source_hash = p_source_hash
       and existing.prompt_version = p_prompt_version then
      return query select existing.id, false, existing.status, existing.body, existing.version, existing.claim_token;
      return;
    end if;
    if existing.status = 'generating' and existing.locked_until > now() then
      return query select existing.id, false, existing.status, existing.body, existing.version, existing.claim_token;
      return;
    end if;
    if existing.status in ('generating','failed')
       and existing.source_hash = p_source_hash
       and existing.prompt_version = p_prompt_version
       and existing.attempts < 3 then
      update public.ka_components set status='generating', attempts=attempts+1,
        claim_token=gen_random_uuid(), locked_until=now()+interval '5 minutes',
        last_error=null, updated_at=now()
      where id=existing.id
      returning * into existing;
      return query select existing.id, true, 'generating'::text, existing.body, existing.version, existing.claim_token;
      return;
    end if;
  end if;

  if found then
    update public.ka_components set status='superseded', locked_until=null, claim_token=null, updated_at=now()
    where id=existing.id;
  end if;

  select coalesce(max(version),0)+1 into next_version
  from public.ka_components
  where knowledge_asset_id=p_asset_id and component_type=p_component_type
    and variant=coalesce(p_variant,'');

  insert into public.ka_components (
    knowledge_asset_id, component_type, variant, version, status,
    source_hash, prompt_version, created_by, attempts, locked_until, claim_token
  ) values (
    p_asset_id, p_component_type, coalesce(p_variant,''), next_version, 'generating',
    p_source_hash, p_prompt_version, p_created_by, 1, now()+interval '5 minutes', gen_random_uuid()
  ) returning * into existing;

  return query select existing.id, true, 'generating'::text, null::jsonb, existing.version, existing.claim_token;
end;
$$;

revoke all on function public.claim_ka_component(uuid,text,text,text,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.claim_ka_component(uuid,text,text,text,text,uuid,boolean) to service_role;

-- Private audio cache bucket for Phase 2 narration reuse.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('ka-component-audio','ka-component-audio',false,52428800,
  array['audio/mpeg','audio/mp3','audio/wav','audio/mp4','audio/ogg','audio/webm'])
on conflict (id) do nothing;

comment on table public.ka_components is 'Versioned reusable components generated from Knowledge Assets. Structured text lives in body; media files live in private Storage.';
comment on table public.ka_component_uses is 'Append-only usage records connecting reusable components to production outputs.';
