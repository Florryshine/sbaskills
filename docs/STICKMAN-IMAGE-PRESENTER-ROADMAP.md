# Stickman 2 — Image Presenter Roadmap

**Status:** Phase 1 foundation established  
**Feature branch:** `feature/stickman-image-presenter`

## Scope

Add a separate Image Presenter production mode under the existing Stickman
Studio. The original Stickman mode remains available and is not replaced.

## Seven phases

1. **Foundation and architecture** — versioned contracts, mode definitions,
   validation, and explicit reuse boundaries.
2. **Intelligent scene planner** — classify single-image, comparison,
   multi-image sequence and diagram scenes; emit structured project data.
3. **Image acquisition** — adapt existing providers, retrieve each comparison
   side independently, validate metadata, retain provenance, deduplicate and
   cache.
4. **Presenter and composition** — reuse the existing character rig and
   deterministic point/present actions; implement layouts for all four modes.
5. **Narration and timeline** — map narration/captions/gestures/images to the
   existing timeline and render contract.
6. **Studio interface** — add a separate Image Presenter mode and editing
   affordances without changing the original production form.
7. **Production testing** — generate and inspect the five sample scenarios,
   run regression checks, and prepare the final pull request.

## Existing-system findings

- The repository's default branch is `master`.
- Stickman lives in `stickman-engine/`, with a typed SceneScript, a pure
  deterministic compiler, character rig/motion modules and a Remotion CLI.
- The rig already supports point and present actions with world-coordinate
  targets. Its compiler resolves FK/IK and emits dense skeleton frames.
- The Visual Learning Engine already has a separate image provider chain and
  compare-scene preparation that schedules distinct left (`a`) and right
  (`b`) retrieval jobs. This is the intended source for image-provider reuse.
- The Visual Learning Engine's renderer and the Stickman renderer are distinct.
  This feature should adapt image assets and scene plans, not merge those
  renderers.
- Existing provider code is Node-oriented and must remain outside client
  bundles.
- The current Stickman package has a dedicated strict TypeScript typecheck
  script. The new domain module is included by its existing `src/**/*.ts`
  tsconfig include pattern.

## Cost and reliability principles

- No new paid image-generation or video-generation dependency.
- Reuse current provider credentials and keyless providers.
- Prefer deterministic templates/rules for composition and gesture choice.
- Keep image source, license and attribution metadata with the selected asset.
- A comparison must fail validation when both sides resolve to the same asset
  ID or canonical media URL.
- Use caching and bounded concurrency in the retrieval phase.
- Preserve the existing worker, storage and Remotion rendering conventions.

## Phase exit criteria

Each phase must add testable code and record its verification. A successful
TypeScript build alone is not proof of a complete video pipeline. The final
phase must generate and inspect real MP4 outputs wherever the configured
services and worker environment permit.
