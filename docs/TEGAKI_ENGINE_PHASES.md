# Tegaki Studio — extraction and build plan

## Phase 1: Independent foundation (this branch)
- Add the dedicated admin route at `/admin/tegaki-studio`.
- Give Tegaki its own lesson editing surface and live Remotion preview.
- Define the engine contract, initial visual-style registry and lesson-scene normaliser.
- Reuse the existing `StudioComposition` Tegaki template without moving or deleting it.
- Keep the legacy Video Studio and Notebook Studio routes and APIs unchanged.
- No database migration, new storage bucket, new environment variable or new AI provider is required.

## Current verified implementation boundaries
- Legacy mode selector and batch script workflow: `app/admin/video-studio/page.js`.
- Existing Tegaki video composition: `TegakiScene` in `remotion/StudioComposition.jsx`.
- Progressive handwriting dependency: `tegaki` and the Caveat font.
- Existing scientific artwork: `remotion/whiteboard/SBAAssetLibrary`.
- Static handwritten notebook image renderer: `lib/notebook-studio/render.js`.
- Static renderer test fixtures: `scripts/test-notebook-render.mjs`.
- Existing video script and narration APIs remain under `app/api/admin/video-studio` for now.

## Extraction safety rules
1. Do not delete or rename legacy Video Studio files during the migration.
2. Do not change the existing Video Studio route, its batch API, or shared Remotion composition in Phase 1.
3. Keep Notebook Studio's renderer API stable; later phases may extract shared low-level drawing helpers behind a compatibility facade.
4. Preserve existing content asset records, metadata, media storage paths and Social Engine publishing behaviour.
5. Keep the current Tegaki template as the compatibility fallback until the dedicated renderer passes visual regression tests.

## Phase 2: Visual style system
Implement style adapters for Classic Notebook, Premium Notes and Exam Revision using Notebook Studio's renderer, then add Colourful Classroom, Dark Chalkboard and Digital Study Pad. A style is not marked available until it has a real rendered preview and a passing fixture.

## Phase 3: Intelligent lesson composition
Generate structured lesson blocks and timed illustration cues from Knowledge Assets. Validate text density, illustration relevance, lesson continuity and cue timing before rendering.

## Phase 4: Animation and audio
Add continuous narration, handwriting timing, diagram/annotation animation, cue transitions, voice controls and optional music. Cache reusable narration and assets.

## Phase 5: Export and publishing
Add reliable preview/export presets for 9:16, 16:9 and 1:1, MP4 rendering, draft persistence, asset reuse and Social Engine handoff.

## Phase 1 acceptance checks
- Dedicated Tegaki route exists independently of the Video Studio route.
- A user can edit a lesson heading and body and preview a continuous Tegaki page.
- The preview uses the existing Tegaki composition and does not invoke AI or create database records.
- Existing Video Studio and Notebook Studio code paths remain untouched.
- Planned styles are visibly labelled as planned, not selectable as working renderers.
