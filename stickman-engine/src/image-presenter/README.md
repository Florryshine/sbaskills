# Stickman 2 — Image Presenter

An additive production mode inside the existing Stickman Studio. It does not replace the original Stickman engine or change its renderer, jobs, routes, or queue.

## Production modes
- single-image: one prominent image with a presenter cue and optional camera zoom.
- two-image-comparison: two independently retrieved and labelled assets.
- multi-image-sequence: an ordered series of image/narration beats.
- diagram-explanation: one diagram with normalized annotation regions.

## Phase 1 — Foundation
- types.ts defines versioned project, scene, asset, caption, presenter and validation contracts.
- validate.ts performs structural checks, validates image URLs and diagram regions, and enforces distinct assets for comparison scenes.

## Phase 2 — Intelligent planner
- planner.ts converts a topic and optional script into an editable deterministic scene plan.
- Auto-classifies comparison, diagram, sequence/process and single-image intent; explicit mode overrides classification.
- Produces bounded scene counts, narration/caption beats, layout intent, presenter gesture hints and image retrieval briefs.
- Comparison plans create two separate image needs with reciprocal distinctFrom constraints.
- The planner intentionally makes no AI or provider calls. This keeps planning reproducible and free, while allowing a future model to propose content without owning validation or layout decisions.
- It emits an intermediate plan, not fake media URLs or render-ready assets. Phase 3 resolves image needs and maps the plan to Phase 1 contracts.

## Existing infrastructure to reuse
- Character skeleton and style presets: src/rig/character.ts.
- Point/present actions: SceneAction in src/rig/character.ts.
- Timeline, captions, audio, camera, overlays and transitions: src/scene/compiler.ts.
- Image retrieval and comparison slots: visual-learning-engine/src/imagery/providers.ts and visual-learning-engine/src/prepare.ts.
- Existing Remotion composition and rendering: src/render/cli.ts.

## Constraints
1. Keep new code under stickman-engine/src/image-presenter/ until an integration point is proven necessary.
2. Do not import Node-only provider modules into browser-facing components.
3. Preserve source, license and attribution metadata.
4. Never silently substitute one comparison side's image for the other.
5. Models may propose lesson structure; deterministic code owns validation, layout, gestures, timing and rendering.
6. Preserve original Stickman Studio functionality.
