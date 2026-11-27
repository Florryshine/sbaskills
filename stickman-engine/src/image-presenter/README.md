# Stickman 2 — Image Presenter

This is an additive production mode inside the existing Stickman Studio. It is
not a replacement for the original Stickman engine and must not change the
existing SceneScript, Timeline, worker queue, routes, jobs, or renderer
contracts.

## Four production modes

- `single-image`: one prominent image with a presenter cue and optional camera
  zoom.
- `two-image-comparison`: two independently retrieved and independently
  labelled assets. The validator rejects the same asset ID or media URL on both
  sides.
- `multi-image-sequence`: an ordered series of image/narration beats.
- `diagram-explanation`: one diagram with normalized annotation regions.

## Phase 1 boundary

- `types.ts` defines the versioned project, scene, asset, caption, presenter,
  and validation contracts.
- `validate.ts` is a pure runtime validator. It performs structural checks,
  validates image URLs and diagram regions, and enforces distinct assets for
  comparison scenes.
- `index.ts` is the public module entry point.

No UI, database migration, worker, provider, or rendering path is introduced
in this foundation phase.

## Existing infrastructure to reuse

- Character skeleton and style presets: `src/rig/character.ts`.
- Existing world-coordinate pointing/present actions: `SceneAction` in
  `src/rig/character.ts`; the deterministic compiler resolves the motion.
- Timeline, captions, audio, camera, overlays and transitions:
  `src/scene/compiler.ts`.
- Image retrieval and per-side compare slots:
  `visual-learning-engine/src/imagery/providers.ts` and
  `visual-learning-engine/src/prepare.ts`. The latter already schedules
  separate `a` and `b` image jobs for comparison scenes.
- Existing Visual Learning provider types and manifests:
  `visual-learning-engine/src/types.ts`.
- Existing Remotion composition and rendering entry point:
  `stickman-engine/src/render/cli.ts`.

Phase 3 will add an adapter around the existing image-provider contract rather
than copy provider implementations. Phase 4 will translate presenter cues to
existing Stickman SceneActions and world-coordinate targets. Phase 5 will map
the resulting scene beats to the existing deterministic timeline.

## Architectural constraints

1. Keep all new code under `stickman-engine/src/image-presenter/` until a later
   phase proves an integration point is needed.
2. Do not import the Visual Learning Engine's Node-only provider modules into
   browser-facing Next.js components.
3. Keep provider provenance and licensing metadata attached to each asset.
4. Never silently substitute one comparison side's image for the other.
5. LLMs may propose lesson structure; deterministic code owns validation,
   layout, gesture mapping, timing and rendering.
6. Preserve the original Stickman Studio and its current queue/render pipeline.
