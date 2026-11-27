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

## Existing infrastructure
- The adapter uses the existing Pexels/Pixabay environment credentials and the same provider services as `visual-learning-engine/src/imagery/providers.ts`.
- Character rig and point/present actions: `src/rig/character.ts`.
- Timeline/audio/camera/overlay compiler: `src/scene/compiler.ts`.
- Remotion entry point: `src/render/cli.ts`.

## Constraints
Keep acquisition server-side; never bundle Node APIs into browser code. Preserve provenance. Never silently reuse one image for both comparison sides. Do not alter the original Stickman pipeline.
