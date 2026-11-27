# Stickman 2 — Image Presenter

An additive production mode inside the existing Stickman Studio. It does not replace the original Stickman engine or change its renderer, jobs, routes, or queue.

## Four modes
- single-image: one dominant visual and presenter cue.
- two-image-comparison: two independently acquired and labelled assets.
- multi-image-sequence: ordered image/narration beats.
- diagram-explanation: one diagram with normalized annotation regions.

## Phase 1 — Foundation
Versioned project/scene contracts, presenter gestures, captions, transitions, image provenance and deterministic validation. Comparison validation rejects identical IDs or media URLs.

## Phase 2 — Intelligent planner
A pure deterministic planner accepts a topic/script and emits bounded scene beats, layout intent, presenter gesture hints and image retrieval briefs. Comparison sides are separate image needs with reciprocal distinctFrom constraints.

## Phase 3 — Image acquisition
- `acquisition.ts` is a Node-only adapter for the same free/keyless provider ecosystem used by Visual Learning: Pexels and Pixabay (existing platform keys), Wikimedia Commons and Openverse (keyless).
- Provider-specific metadata is retained: landing/source URL, creator/attribution, license label and attribution requirement where the provider supplies them.
- Candidates without a traceable license signal are skipped rather than treated as reusable.
- Images are downloaded, normalized, SHA-256 hashed and stored under the job public directory.
- A persistent cache is keyed by search query and aspect ratio. Cached files are reused only when they still exist.
- Comparison sides are checked against actual normalized bytes. If no distinct result is available, the need remains unresolved with a warning; no generic placeholder or duplicate is substituted.
- This phase does not yet convert acquired files into render-ready scenes. Phase 4/5 handles composition and timeline mapping.

## Phase 4 — Presenter and visual composition
- Added a pure deterministic layout planner for all four scene modes and all three output ratios.
- Single-image scenes use image-dominant hero layouts; comparison scenes use stacked portrait or side-by-side landscape/square layouts with persistent labels.
- Sequence scenes preserve item order in vertical or horizontal card grids; long sequences emit a split-scene warning.
- Diagram scenes map normalized annotation rectangles into exact frame-space rectangles, preserving their relationship to the acquired image.
- Presenter placement reserves a collision-aware region and derives point-left/right/up/down targets from the image bounds. Explicit normalized targets take precedence.
- Single-image zoom intent is clamped to safe bounds and expressed as camera focal/scale metadata for Phase 5's timeline adapter.
- Composition output is renderer-agnostic and uses normalized geometry. The existing character rig and renderer remain untouched; no second skeleton or legacy renderer fork is introduced.
- The module deliberately returns geometry and cue metadata, not an MP4 or a render-ready Remotion composition. Phase 5 will map these placements into the established timeline/render contract.

## Phase 5 — Narration and timeline synchronization
- Added `compileImagePresenterTimeline`, an adapter that turns project scenes into the existing `SceneScript` and invokes the existing deterministic compiler.
- Uses the established compiler for frame allocation, narrator audio placement, word-level caption timing, character streams and camera keyframes.
- Sequence items become ordered narration beats. Diagram annotations with narration become separately timed beats; their normalized regions are emitted as frame-accurate annotation events.
- Emits image events with exact scene frame spans, composition regions, local acquired file paths, attribution and license metadata.
- Emits presenter cue events aligned to each narration beat and maps pointing/explaining/surprise/thinking cues to existing rig actions.
- Narration map keys retain the existing `sceneIndex:lineIndex` convention. Supplied measured audio durations drive compiler timing; text-duration estimates are only fallbacks.
- The adapter returns a synchronized timeline plus image/annotation/presenter event tracks. The current Remotion renderer does not yet draw those image events; Phase 6/7 will wire the composition and controls into the studio/render path.

## Existing infrastructure
- The adapter uses the existing Pexels/Pixabay environment credentials and the same provider services as `visual-learning-engine/src/imagery/providers.ts`.
- Character rig and point/present actions: `src/rig/character.ts`.
- Timeline/audio/camera/overlay compiler: `src/scene/compiler.ts`.
- Remotion entry point: `src/render/cli.ts`.

## Constraints
Keep acquisition server-side; never bundle Node APIs into browser code. Preserve provenance. Never silently reuse one image for both comparison sides. Do not alter the original Stickman pipeline.


## Phase 6 — Studio authoring interface
The separate `/admin/stickman-engine/image-presenter` page provides topic/script input, mode/aspect selection, editable scene titles and narration, image-need review, image previews, acquisition coverage and source/licence/creator attribution. Its protected Node API keeps provider credentials and Sharp/filesystem work off the client. Successful normalized files are persisted to the existing `lesson-videos` Supabase bucket rather than relying on ephemeral serverless disk. This remains an authoring/acquisition workspace; final worker consumption and Remotion image-track drawing are Phase 7.
