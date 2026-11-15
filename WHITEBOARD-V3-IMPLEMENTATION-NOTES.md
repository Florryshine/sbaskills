# SBA Whiteboard Engine v3 — implementation notes

## Architecture
- Next.js admin interface creates jobs and generates narration.
- Supabase stores jobs, narration and completed videos.
- Render Background Worker runs the Remotion renderer.
- Completed videos are saved into the existing content_assets and media_files pipeline.

## Database
Apply supabase/migrations/20261113_whiteboard_engine_jobs.sql.
This migration creates the job table, RLS policies, narration bucket,
reliability columns and atomic claim function.

## Worker
Render builds local-video-renderer/Dockerfile.
Required secrets:
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

The worker uses Bun and Remotion Chrome Headless Shell.
Run one end-to-end render before treating the feature as production-ready.
