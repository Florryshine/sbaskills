# Stickman 2 — Image Presenter Roadmap

**Status:** Phase 4 composition planner implemented; awaiting CI verification  
**Feature branch:** feature/stickman-image-presenter

## Scope
Add a separate Image Presenter production mode under the existing Stickman Studio. The original Stickman mode remains available and is not replaced.

## Seven phases
1. Foundation and architecture — versioned contracts, mode definitions, validation and reuse boundaries.
2. Intelligent scene planner — classify the four modes and emit structured scene plans.
3. Image acquisition — provider retrieval, provenance, licensing, byte-level deduplication and caching.
4. Presenter and composition — implemented deterministic layout geometry, presenter anchors/targets, image framing, diagram annotation mapping and zoom metadata for all four modes. Phase 5 will connect this output to the render timeline.
5. Narration and timeline — map narration, captions, gestures and images to the existing timeline and render contract.
6. Studio interface — add a separate Image Presenter mode and editing affordances without changing the original production form.
7. Production testing — generate and inspect sample scenarios, run regression checks and prepare the final pull request.

## Phase 3 decisions
- Uses Pexels/Pixabay with existing platform credentials and keyless Wikimedia Commons/Openverse.
- Retains source landing URL, creator/attribution, license label and attribution requirement when supplied.
- Candidates without traceable license metadata are skipped.
- Downloaded images are normalized, SHA-256 hashed and cached by query/aspect.
- Comparison pairs are checked against normalized bytes. Missing or duplicate images remain unresolved with warnings; no placeholders are substituted.
- Acquisition is Node-only and is not imported into browser bundles.
- This phase does not yet attach assets to render-ready project scenes; Phase 4/5 handles composition and timeline mapping.

## Reuse and boundaries
Stickman retains its own deterministic compiler, character rig and Remotion renderer. Visual Learning remains the source ecosystem for free image providers and existing credentials. No existing Stickman jobs, routes, queue or renderer are changed.

## Cost and reliability
No new paid API or new key. Reuse existing credentials and keyless sources. Cache normalized files, preserve attribution and fail transparently when no licensed/distinct result is available.
