-- Image-to-Explainer Studio foundation.
-- Uses a private source bucket; generated videos will be saved through the existing lesson-videos contract.
create table if not exists public.image_explainer_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  title text not null default 'Image explainer project',
  status text not null default 'analysed'
    check (status in ('uploaded','analysing','analysed','researching','scripting','storyboarding','narrating','rendering','ready','failed','cancelled')),
  stage text not null default 'uploaded',
  stage_message text,
  production_mode text not null default 'educational'
    check (production_mode in ('educational','product_ad','product_demo','scientific','technical','documentary','general')),
  user_instruction text,
  spec jsonb not null default '{}'::jsonb,
  source_images jsonb not null default '[]'::jsonb,
  vision_analysis jsonb,
  research_bundle jsonb,
  script jsonb,
  storyboard jsonb,
  narration_manifest jsonb,
  timeline jsonb,
  video_url text,
  storage_path text,
  error_message text,
  attempt_count integer not null default 0,
  claim_token uuid,
  worker_id text,
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_image_explainer_queue
  on public.image_explainer_jobs(status, created_at)
  where status in ('uploaded','analysed','researching','scripting','storyboarding','narrating','rendering');
alter table public.image_explainer_jobs enable row level security;
drop policy if exists "Admins can manage image explainer jobs" on public.image_explainer_jobs;
create policy "Admins can manage image explainer jobs" on public.image_explainer_jobs
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('image-explainer-sources','image-explainer-sources',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['image/jpeg','image/png','image/webp'];
