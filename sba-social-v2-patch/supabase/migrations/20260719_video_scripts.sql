-- ============================================================================
-- Patch: video_scripts table
-- Connects the existing video engine (lib/video-engine/narration.js,
-- lib/video-engine/render.js, local-video-renderer/worker.js) to the v2
-- content pipeline (content_assets / media_files) instead of rebuilding
-- video rendering from scratch.
--
-- Column names/shapes match exactly what narration.js and render.js already
-- read: script.title, script.format, script.script_segments,
-- script.render_status, script.render_error. worker.js already does:
--   .from('video_scripts').select('*').eq('render_status', 'pending')
--   .from('video_scripts').update({ render_status, video_url, render_error })
-- This migration just adds content_asset_id so the worker can close the loop
-- back into media_files once a render finishes.
-- ============================================================================

create table if not exists video_scripts (
  id uuid primary key default gen_random_uuid(),

  -- links this render job back to the draft it belongs to, so the worker
  -- can attach the finished video to the right content_assets row.
  -- nullable: a script can be queued before the content_asset row exists
  -- (not currently needed by the patched generators, but kept flexible).
  content_asset_id uuid references content_assets(id) on delete cascade,

  title text not null,
  format text not null default 'short',   -- 'short' (vertical) | 'long' (horizontal)

  -- array of { text, visual_cue, stock_search, durationSeconds? }
  -- read directly by narration.js (synthesizeLessonNarration) and
  -- render.js/worker.js (findVisualForCue / fetchStockVideo per segment)
  script_segments jsonb not null default '[]'::jsonb,

  render_status text not null default 'pending'
    check (render_status in ('pending','rendering','completed','failed')),
  render_error text,
  video_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_video_scripts_status on video_scripts(render_status);
create index if not exists idx_video_scripts_content_asset on video_scripts(content_asset_id);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_video_scripts_updated on video_scripts;
create trigger trg_video_scripts_updated before update on video_scripts
  for each row execute function set_updated_at();

-- Same pattern as the rest of the v2 schema: service-role only. The local
-- render worker and the admin API routes both use createAdminClient()
-- (service key), never the anon/browser client, so no anon/authenticated
-- policy is defined here on purpose — matches the explicit-role fix already
-- applied to the other v2 tables (a policy with no `to <role>` clause
-- defaults to PUBLIC, including anon, which is not what we want here).
alter table video_scripts enable row level security;

create policy "service role full access" on video_scripts for all
  to service_role using (true) with check (true);
