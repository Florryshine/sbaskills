# Cartoon Studio — SBA Integration Plan

Status: Phase A architecture audit  
Target base: `master`  
Working branch: `feat/cartoon-studio-integration`  
Source implementation: `main` at `7a7fec5`  
Production code is not modified by this plan.

## 1. Verified SBA production architecture

The current repository is a root-level Next.js application, not a `src/`-based application:

- Routes live under root `app/`.
- Shared application code lives under root `lib/` and `components/`.
- `jsconfig.json` maps `@/*` to the repository root.
- Production uses Next.js `14.2.30`, React/React DOM `18.3.1`, and Node `24.x`.
- Remotion packages are already installed at the same pinned version: `4.0.541`.
- The current Next configuration is `next.config.js`; it includes PWA, image, external-package and webpack settings. It must be preserved.
- Existing production database access is Supabase JS, not Prisma.

The root `app/` directory already exists and the repository has no root `src/` tree. Therefore Next.js will ignore the uploaded `src/app/**` route handlers if copied in their original location. Cartoon routes must be ported into root `app/api/**`.

## 2. Existing engine patterns to reuse

SBA already has durable worker-based engines:

- Whiteboard: `whiteboard_jobs`, `claim_whiteboard_job()`, `local-video-renderer/whiteboard-worker.js`.
- Stickman: `stickman_jobs`, `claim_stickman_job()`, heartbeat/lease handling, `local-video-renderer/stickman-worker.js`.
- Music Learning has its own background-render job migration and worker workflow.
- These workers use Supabase service-role access, persistent job state, storage buckets, stage/progress reporting, retries and idempotent saves.

Cartoon must follow this established model. Its sandbox's API-triggered `void runScriptPipeline()` and child-process render orchestration must not be used as production background execution. The production API should authenticate, validate and enqueue; the persistent worker should claim, process, heartbeat, recover and save.

## 3. Production integrations

### Authentication
Replace the sandbox `requireAdmin()` stub (which always returns success) with the existing `requireAdminApi()` pattern in root API route handlers. Service-role database access belongs in worker/server-only code, never in client components.

### Knowledge Assets and AI
Use the existing `knowledge_assets` table and shared LLM fallback infrastructure (`lib/llmFallbackChain.js`, `lib/aiModels.js`, `lib/robustJsonParse.js` where appropriate). Preserve the Cartoon storyboard's tolerant JSON repair and strict schema/catalog validation.

Custom-topic projects still need a valid Knowledge Asset when their output is registered as a `content_assets` row: the existing production schema requires `content_assets.knowledge_asset_id`. Reuse/adapt the resolve-or-create Knowledge Asset pattern already present in the Stickman API. Do not create an unlinked publishing asset.

### Narration
Replace the sandbox Z.ai SDK/TTS implementation with the existing `lib/podcastTTS.js` `synthesizeLine()` provider chain and its retry/audio-normalization conventions. Keep measured WAV duration and word-timing logic. Worker narration files should be uploaded to a dedicated Cartoon audio bucket and referenced by storage path/public URL, not written into ephemeral Next serverless filesystem paths.

### Rendering
Reuse the existing Remotion installation, version pins and worker infrastructure. Add Cartoon composition registration to root `remotion/Root.jsx` and/or the existing Remotion entry point without replacing LessonVideo or WhiteboardVideo. Keep Chrome/Remotion rendering outside Next serverless route bundles.

The engine's visual components can be ported as a dedicated folder under `remotion/cartoon-studio/`; only adapt imports, media URL resolution and any incompatible component APIs. Do not upgrade Next, React or the whole dependency graph to match the sandbox.

### Storage and media
Use Supabase Storage and the existing `lesson-videos` bucket for final MP4s, following the established worker storage contract. Use a dedicated Cartoon audio bucket for scene narration. Do not store production output in `public/cartoon-media` or rely on local worker files being publicly served.

### Social Publishing contract — important schema correction
The sandbox documentation/schema is not an exact representation of production:

- Production channel table is `social_channels_v2`, not `social_channels`.
- Production `publish_jobs.channel_id` references `social_channels_v2`.
- Production `content_assets.knowledge_asset_id` is required.
- Production `content_assets` does not have the sandbox's `project_id` field.
- Production publishing is executed through `lib/publish-engine.js` / `executePublishJob()`, which reads the existing `content_assets`, `media_files`, `publish_jobs` and `social_channels_v2` tables.

Therefore discard the sandbox's Prisma publishing models and simulated publish route. Register the rendered output using the real Supabase schema: `content_assets` + `media_files`; store the Cartoon project ID as a recovery key in `content_assets.metadata`. Create publish jobs against active `social_channels_v2` rows and delegate actual publishing to `executePublishJob()`.

## 4. Shared Visual Asset Library

The uploaded library is currently Prisma/local-filesystem based. Port its data-access and storage adapters to Supabase while preserving its discovery/ranking/catalog logic.

Add one shared `visual_assets` table and one `visual-assets` Storage bucket through a new, additive Supabase migration. Keep licence/source/creator/attribution metadata first-class. The library must be engine-neutral so Cartoon, Whiteboard, Notebook and future Mixed Media engines can consume the same assets.

Do not duplicate assets already present in the repository or create per-engine asset libraries. Keep local static SVGs usable as bundled/fallback assets, while new uploaded/generated assets use Supabase Storage.

## 5. Target production layout

Proposed layout (exact filenames to be confirmed during implementation):

- `remotion/cartoon-studio/**` — pure visual composition, characters, scenes, effects and types.
- `remotion/Root.jsx` — register Cartoon composition alongside existing compositions.
- `lib/cartoon/**` — storyboard validation, provider adapters, data access and shared-library integration.
- `app/admin/cartoon-studio/**` — admin studio page and UI components.
- `app/api/admin/cartoon-studio/**` — authenticated project, character, scene-regeneration and render endpoints.
- `local-video-renderer/cartoon-worker.js` — durable Supabase worker following Whiteboard/Stickman claim and heartbeat conventions.
- `supabase/migrations/**` — additive Cartoon jobs/characters and shared visual-assets schema, indexes, RLS, claim/heartbeat RPCs and storage buckets.
- `public/visual-assets/**` — only vetted bundled catalogue assets/fallbacks; runtime library files live in Supabase Storage.

## 6. Explicitly out of scope for this phase

- No Next.js, React, Remotion or package-manager upgrade.
- No Prisma client, SQLite database or sandbox Z.ai SDK in production.
- No replacement of `package.json`, `next.config.js`, `remotion/Root.jsx` or existing worker files.
- No changes to existing Whiteboard, Stickman, Music Learning or Social Publishing behavior.
- No Supabase production migration execution.
- No deployment to Vercel or worker host.

## 7. Phase A acceptance checks

Before implementation proceeds:

1. Keep all changes on `feat/cartoon-studio-integration`, based on current `master`.
2. Preserve the production dependency/configuration baseline.
3. Use root `app/` routing and existing admin authentication.
4. Reuse current Knowledge Asset, TTS, Remotion worker, Storage and publishing contracts.
5. Ensure migration SQL is additive and accurately matches the live production table relationships.
6. Add isolated Cartoon tests/smoke checks without modifying existing engine test paths.

This document is an architecture decision record, not evidence that the engine has already been ported or that any database migration has been applied.


## 8. Phase A implementation foundation — completed 2026-11-20

Phase A now includes the first additive production-schema foundation on
`feat/cartoon-studio-integration`:

- Added `supabase/migrations/20261120080000_cartoon_studio_foundation.sql`.
- Added `cartoon_projects`, `cartoon_jobs`, `cartoon_workers`, and
  `cartoon_characters` tables with project/job state, progress, bounded
  retries, worker leases, and ownership fields.
- Added an engine-neutral `visual_assets` catalogue with content-hash
  deduplication, search metadata, source/licence/creator/attribution fields,
  and a Storage path.
- Added admin RLS policies for project, character, job and visual-asset
  access; worker liveness is service-role only.
- Added the `cartoon-assets` and `visual-assets` Storage buckets.
- Added atomic `claim_cartoon_job` and lease-guarded
  `cartoon_job_heartbeat` RPCs, following the existing Whiteboard,
  Stickman and Music Learning worker patterns.

### Phase A safety boundary

This migration is committed to the integration branch only. It has NOT been
applied to the live Supabase project. No Vercel deployment, package/config
change, existing engine modification, publishing change, or production
branch update was made.

The migration intentionally does not yet install a GitHub Actions dispatch
trigger: that must be wired to the actual Cartoon worker workflow in the
worker implementation phase, rather than dispatching jobs to a nonexistent
handler. API routes, Supabase adapters, the worker, Remotion composition
registration, UI and runtime tests remain subsequent implementation work.

### Verification performed

- Compared `feat/cartoon-studio-integration` against `master`: the branch
  is exactly 2 commits ahead and 0 commits behind.
- The only changed files are this integration plan and the additive
  Cartoon/Visual Asset migration.
- Confirmed the migration file is present on the integration branch and
  includes both worker RPCs and the shared visual-assets table.
- Confirmed no changes were made to `package.json`, lockfiles,
  `next.config.js`, existing Remotion registrations, or existing workers.

Phase A is complete as an architecture and database-foundation phase. The
runtime port begins in the next phase after this migration is reviewed and
applied in the intended Supabase environment.


## 9. Phase B — runtime implementation started

Branch: `feat/cartoon-studio-phase-b` (branched from the Phase A integration branch).

### Implemented in this branch

- Ported the Cartoon Remotion visual engine into the SBA root-level tree:
  `cartoon/engine/**`. This includes character rigs, expressions, hair,
  presets, animated concept backgrounds, scene props, transitions, subtitles,
  and shared-asset scene placements.
- Registered the `CartoonVideo` composition alongside the existing
  LessonVideo and WhiteboardVideo compositions in `remotion/Root.jsx`.
- Removed the source branch's font-file loading dependency and disabled
  source-only music-file references because those binary music assets are
  not present on SBA `master`. Narration audio remains supported by
  absolute Supabase Storage URLs.
- Ported storyboard validation and connected generation to SBA's existing
  `generateWithFallback` + `parseJsonFromText` chain.
- Added an admin-only Cartoon Studio API for project creation, status reads,
  and durable script/narration/render job enqueueing.
- Added `local-video-renderer/cartoon-worker.js` using the existing worker
  architecture: atomic claims, lease heartbeats, retry limits, narration
  checkpoints, Remotion rendering, Supabase Storage uploads, and idempotent
  `content_assets` / `media_files` registration.
- Connected scene visual selection to the engine-neutral `visual_assets`
  catalogue. Matching is deterministic and keyword-based; it does not spend
  an extra LLM call.
- Added a secure admin upload/search API and admin page for the shared
  Visual Asset Library, including content-hash deduplication and SVG
  sanitization.
- Added the Cartoon Studio admin page and navigation entries.
- Added scheduled GitHub Actions worker and composition smoke-test workflows.
- Hardened stale-job retry exhaustion in the additive migration.

### Current runtime flow

1. Admin creates a topic from `/admin/cartoon-studio`.
2. API creates a `cartoon_projects` row and a queued `script` job.
3. GitHub Actions checks the queue every five minutes and runs the persistent
   worker when queued or abandoned work exists.
4. Worker loads the selected Knowledge Asset (or uses the topic), generates
   and validates a storyboard through SBA's shared LLM fallback chain, and
   links/creates a Knowledge Asset when required.
5. Worker attaches matching shared visual assets, generates narration through
   `lib/podcastTTS.js`, and stores audio in Supabase Storage.
6. Admin queues a render. Worker renders the `CartoonVideo` Remotion
   composition, uploads the MP4 to `lesson-videos`, and registers the output
   through the existing content library contract.

### Not yet verified / remaining Phase B work

- The migration is still not applied to the live Supabase project.
- The GitHub Actions workflows have been committed but have not yet been
  executed; the Remotion bundle and worker have not passed a live CI run.
- No Vercel deployment or production database write has been made.
- The five-minute scheduled worker cadence is intentional for this first
  integration. Immediate event dispatch can be added after the first worker
  run is verified.
- The visual library's first matching pass is keyword-based. Richer ranking,
  per-scene editing, source-provider ingestion, and asset-use analytics remain
  follow-up improvements.
- Cartoon background music is intentionally disabled until compatible music
  files are added to SBA's production public assets.
- The current admin studio creates, tracks, retries and renders projects; a
  full scene-by-scene storyboard editor and in-browser Remotion preview remain
  to be integrated.

### Safety boundary

All Phase B code remains on `feat/cartoon-studio-phase-b`. Production
`master`, existing engines, and live Supabase have not been changed.
