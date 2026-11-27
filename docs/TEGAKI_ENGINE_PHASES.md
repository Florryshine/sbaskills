# Tegaki Studio — extraction and build plan

## Phase 1: Independent foundation
- Dedicated admin route at `/admin/tegaki-studio`.
- Independent lesson editor and live Remotion preview.
- Engine contract, lesson scene normaliser and visual-style registry.
- Reuse the existing Remotion Tegaki composition without moving or deleting it.
- Legacy Video Studio and Notebook Studio routes and APIs remain intact.

## Phase 2: Visual style system (implemented on this branch)
- Add six style adapters: Classic Notebook, Premium Notes, Exam Revision, Colourful Classroom, Dark Chalkboard and Digital Study Pad.
- Render real PNG page previews through `/api/admin/tegaki-studio/preview`.
- Reuse Notebook Studio's handwriting layout engine through a Tegaki adapter; keep its existing API and renderer contract stable.
- Add a six-style renderer fixture script at `scripts/test-tegaki-styles.mjs`.
- Do not describe these page-image previews as finished animated video templates: Remotion video integration and multi-aspect-ratio layouts remain later work.

## Phase 3: Intelligent lesson composition
Generate structured lesson blocks and timed illustration cues from Knowledge Assets. Validate text density, illustration relevance, lesson continuity and cue timing before rendering.

## Phase 4: Animation and audio
Add continuous narration, handwriting timing, diagram/annotation animation, cue transitions, voice controls and optional music. Cache reusable narration and assets.

## Phase 5: Export and publishing
Add reliable preview/export presets for 9:16, 16:9 and 1:1, MP4 rendering, draft persistence, asset reuse and Social Engine handoff.

## Migration safety
1. Do not delete or rename legacy Video Studio files during extraction.
2. Keep Notebook Studio's renderer API stable; Tegaki uses its exported SVG builder through a separate adapter.
3. Preserve existing content asset records, metadata, media storage paths and Social Engine publishing behaviour.
4. Keep the existing Remotion Tegaki template as the compatibility fallback until the dedicated renderer/video integration passes visual regression tests.
