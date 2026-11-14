# SBA Whiteboard Engine v3 — implementation overlay

This archive contains the Whiteboard Engine v3 source and the reliability fixes prepared from the supplied project ZIP.

## Included fixes
- Atomic worker claiming through `claim_whiteboard_job()` with a renewable lease and stale-lease recovery.
- Persistent Bun worker owns narration, timeline creation, and Remotion rendering; Vercel only creates durable jobs and returns immediately.
- Renewable worker heartbeat continues through both narration and rendering; stale narrating/rendering jobs can be reclaimed.
- Stable Storage object path and idempotent recovery for `content_assets` and `media_files`.
- Knowledge Asset resolution before job creation. This is required because the existing `content_assets.knowledge_asset_id` column is NOT NULL.
- Correct subject precedence: an explicit `@subject` in the script wins; otherwise the selected admin form subject is used.
- Correct marker fade-out: retain the last pen-tip position while fading instead of immediately hiding the marker.
- Non-overlapping admin status polling.

## Required before production use
1. Apply `20261113_whiteboard_engine_jobs.sql`, then `20261114_whiteboard_engine_reliability.sql`, to the SBA production Supabase project. The second migration assumes the base `whiteboard_jobs` table already exists.
2. Install dependencies at the repository root and in `whiteboard-engine/` (dependency alignment is a separate follow-up).
3. Run the persistent worker from the repository root with `bun run local-video-renderer/whiteboard-worker.js`. It loads `.env.local`; the host must have the Supabase URL/service-role key and the configured Gemini/Edge TTS environment. Do not run this worker inside a Vercel function.
4. The API creates `narrating` jobs; the worker claims them, creates narration/timeline, renders the MP4, and links it into `content_assets` + `media_files`.
5. Verify one end-to-end render, then confirm the resulting asset appears in the existing Social Engine.

## Validation performed in this environment
- `node --check` passed for the worker, API route and admin page.
- All relative imports inside `whiteboard-engine/src` resolve to files present in the archive.
- Font files are valid TrueType fonts.
- Full dependency install/build/typecheck was not completed because this environment could not resolve `registry.npmjs.org` (EAI_AGAIN). This is not a successful full typecheck.

This archive is an overlay, not a deployment. Existing SBA files outside the listed paths are intentionally untouched.
