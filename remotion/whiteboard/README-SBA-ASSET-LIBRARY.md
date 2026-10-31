# SBA Core Illustration Pack v1

A local, reusable SVG illustration library for SBA's Remotion video system.

## What's included
- 70 named illustration IDs across Biology (22), Chemistry (14), Physics (14), Animals (7), Nature/scenery (7), and food/everyday objects (6).
- React SVG renderer with a consistent hand-drawn educational visual language.
- Catalogue and lookup helpers for AI scene generation and future admin selection.
- No external asset host, paid API, subscription, or additional package.

## Import
```jsx
import { SBAIllustration, findSBAIllustration, SBA_ASSET_CATALOG } from './whiteboard/SBAAssetLibrary';

<SBAIllustration type="human-heart" />
```

## Scene JSON
Whiteboard scenes can request an asset using `assetId` or `illustrationAsset`:
```json
{ "heading": "The human heart", "assetId": "human-heart", "narration": "The heart pumps blood around the body." }
```

Story Reel scenes can use the same fields. If a valid asset ID is present, it replaces the default decorative StoryArt for that scene; otherwise StoryArt remains the fallback.

## Catalogue helpers
- `SBA_ASSET_CATALOG`: metadata for all 70 assets.
- `SBA_ASSET_IDS`: stable IDs for validation and prompts.
- `SBA_ASSET_ALIASES`: common short names.
- `findSBAIllustration(query)`: finds an asset by ID or display name.

## Notes
- Assets are authored as original SVG primitives in this repository and marked `SBA-original`; they are not downloaded third-party illustrations.
- This is v1 artwork: diagrams are explanatory illustrations, not precision laboratory schematics or medical references. Scientific labels, proportions, arrows, and exact apparatus connections should be reviewed before using an image to teach a detail-sensitive JAMB question.
- Current animation is a simple reveal/fade. Individual path-by-path draw sequencing and richer scene motion can be added in later passes.
