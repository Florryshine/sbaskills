# Stickman 2 — Image Presenter Roadmap

**Status:** Phase 2 planner implemented; awaiting CI verification  
**Feature branch:** feature/stickman-image-presenter

## Scope
Add a separate Image Presenter production mode under the existing Stickman Studio. The original Stickman mode remains available and is not replaced.

## Seven phases
1. Foundation and architecture — versioned contracts, mode definitions, validation and reuse boundaries.
2. Intelligent scene planner — classify the four modes and emit structured scene plans.
3. Image acquisition — adapt existing providers, retrieve comparison sides independently, validate metadata, retain provenance, deduplicate and cache.
4. Presenter and composition — reuse the existing character rig and deterministic point/present actions; implement layouts for all four modes.
5. Narration and timeline — map narration, captions, gestures and images to the existing timeline and render contract.
6. Studio interface — add a separate Image Presenter mode and editing affordances without changing the original production form.
7. Production testing — generate and inspect sample scenarios, run regression checks and prepare the final pull request.

## Phase 2 planner decisions
- The planner is pure and deterministic; it makes no model or provider calls.
- A project has one selected mode. The planner emits homogeneous scenes, matching the Phase 1 validation contract.
- Auto mode inference prioritizes comparison, then diagram, then sequence, then single image.
- The planner emits intermediate image briefs, not fabricated media URLs or render-ready assets.
- Comparison sides are separate jobs and carry reciprocal distinctness hints.
- Script beats are bounded to 1–12 scenes; ambiguity and truncation are surfaced as warnings.
- No original Stickman renderer or production route is changed.

## Reuse findings
- Stickman has a typed SceneScript, deterministic compiler, character rig/motion modules and Remotion CLI.
- The rig already supports point and present actions with world-coordinate targets.
- Visual Learning Engine already has a provider chain and comparison preparation with distinct left (a) and right (b) retrieval jobs.
- Visual Learning and Stickman renderers are distinct; adapt assets and plans, do not merge renderers.
- Provider modules are Node-oriented and must remain outside client bundles.

## Cost and reliability
No new paid image/video dependency. Reuse existing provider credentials and keyless providers. Prefer deterministic templates/rules for composition and gesture choice. Preserve image provenance and licensing. Use caching and bounded concurrency in Phase 3. Preserve existing worker, storage and Remotion conventions.

## Phase exit criteria
Each phase adds testable code and records verification. A successful TypeScript build alone is not proof of a complete video pipeline. The final phase must generate and inspect real MP4 outputs wherever configured services and worker environment permit.
