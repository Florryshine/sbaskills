# SBA Whiteboard Engine v3 — Architecture

> Status: implemented on branch `feature/whiteboard-engine-v3`.
> Goal: turn ordinary lesson scripts into professional, narration-synced whiteboard
> teaching videos that feel like a real teacher writing and drawing on a board.

## 1. Why a rebuild (findings from auditing the existing implementation)

| Existing approach | Problem |
|---|---|
| `ImageRevealVisual` (default for AI scenes) | Photo + CSS clip-path wipe. The "scribble" option is byte-identical to the wipe, the hand is a cosine sweep sticker. This is the slideshow look. |
| `DrawnVisual` (real stroke reveal) | Unreachable: no planner ever emits `strokes`; its computed hand was deleted. |
| `SBAAssetLibrary` (70 SVG assets) | Whole-group opacity fade — nothing is ever *drawn*. |
| Timing | Durations from word-count estimates clamped 5-8s; narration truncated to 18 words; Edge-TTS word boundaries discarded; audio can overflow its Sequence. |
| Old Python engine (`whiteboard_animation_2`) | Orphaned; text is a mask crop; images are wipes; manual second-based timing. |

The core insight: **nothing in the old pipeline was ever "written" or "drawn"** —
everything was revealed. The new engine inverts that: every element is a
progressive drawing action whose timing is driven by the narration.

## 2. Design principles

1. **Stroke-first.** Every visual element (text, diagrams, arrows, highlights,
   equations) is expressed as SVG strokes drawn progressively via
   `strokeDasharray` + `strokeDashoffset`. Text uses a two-layer technique:
   handwriting font + per-word clip reveal + a tracked marker tip, so words
   appear *written*, not faded.
2. **Narration-driven timeline.** TTS word-boundary timestamps (Edge-TTS,
   100ns ticks) map every element to the exact narration phrase it belongs to.
   With fallback providers, word timings are reconstructed proportionally from
   measured audio duration.
3. **Precomputed geometry.** Path sampling (`point-at-length`) happens at
   *build time* in Node: every stroke becomes a polyline with a length,
   a draw-duration share, and pen-tip positions. The Remotion renderer does
   zero geometry work — renders are deterministic and fast.
4. **Subject-aware.** Themes + illustration registry per subject
   (biology / chemistry / physics / mathematics / general). Layouts differ per
   scene kind (title / concept / diagram / equation / list / summary).
5. **Declarative scene JSON.** One schema, two producers:
   the deterministic script parser (demos, admin "paste script" flow) and an
   LLM planner (admin "generate from topic" flow, via `generateWithFallback`).

## 3. Pipeline

```
lesson script (.txt DSL)  ─┐
                           ├─> parse → VideoSpec (scenes, elements, sync refs)
LLM planner (admin)       ─┘
        │
        ▼
narration providers ─> per-scene audio + word timings
   edge-tts (production, local worker)
   z-ai tts (sandbox demos)
   pre-recorded wav (user-provided audio)
        │
        ▼
timeline builder (Node)
   - layout engine: zones per scene layout, text wrapping, bbox computation
   - geometry: sample all strokes, compute lengths + draw shares + tips
   - schedule: elements → seconds, driven by narration word timings
        │
        ▼
timeline.json  +  public/narration/*.wav
        │
        ▼
Remotion (Chrome headless) ─> H.264 MP4 (1920x1080, 30fps)
        │
        ▼
SBA infrastructure: lesson-videos bucket → content_assets + media_files
   → Social Engine (YouTube/TikTok publishers require the media_files row)
```

## 4. Sync model

- Every scene: `lead-in (0.5s)` → narration → `tail pad (0.9s)` where the last
  drawings settle.
- Element `sync` refs: `{phrase}` (substring → first word index in the scene's
  narration), `{fraction}`, or `{wordIndex}`. No explicit sync → auto-scheduled
  sequentially after the previous element.
- Text elements map their own words onto the narration span they are synced to
  (1:1 pacing when the element quotes the narration).
- Illustrations draw at a rate proportional to their total stroke length,
  clamped so they complete shortly after their narration sentence ends.

## 5. Visual system

- **Board**: clean white, subtle corner vignette, very light paper grain.
- **Ink**: near-black slate. One accent color per subject theme + warm marker
  yellow for highlights. At most 3 colors per frame.
- **Typography**: Caveat Bold (headings, 88-104px), Patrick Hand (body,
  40-46px), Kalam (labels/callouts, 32px).
- **Camera**: slow push-in per scene (1.03 → 1.0), gentle drift; hard cuts with
  a short soft white flash between scenes (chalk-dust wipe feel).
- **Pen**: stylized marker hand follows the active tip while anything is being
  drawn; slides off when the board rests.
- **Illustrations**: multi-stroke line drawings (viewBox ~400x400), stroke
  order authored for teaching (outline → details → annotations), optional fill
  that fades in *after* its outline is drawn.

## 6. Module map

```
src/types.ts               scene schema + timeline types
src/themes.ts              subject themes
src/geometry/path-sample.ts     SVG d-string → sampled polyline (build time)
src/illustrations/*        stroke-path asset registry (5 subject files)
src/script/parser.ts       DSL → VideoSpec
src/narration/*            TTS providers + word timing
src/timeline/builder.ts    layout engine + scheduling → Timeline JSON
src/remotion/*             Remotion composition + element renderers
src/render/cli.ts          end-to-end: script → MP4
```

## 7. Integration with SBA

- `whiteboard-engine/` is self-contained (own package.json, deps installed
  locally). The Next.js app imports the *pure-TS* modules (types, parser,
  timeline builder) via relative paths for the admin API route; Remotion is
  not imported by the app.
- Rendering runs where Chrome can run: the existing local worker
  (`local-video-renderer/`) gets a whiteboard-job poller. The admin route
  creates the job (timeline + narration uploaded to Supabase), the worker
  renders and saves through the established
  `lesson-videos` + `content_assets` + `media_files` contract so the Social
  Engine can publish the result.
- New admin page: `/admin/whiteboard-engine` (paste script or AI-generate →
  preview in `@remotion/player` → queue render → poll status).

## 8. Known constraints

- Edge-TTS is blocked from datacenter IPs (their service policy): narration on
  Vercel uses the Gemini-TTS provider; the worker path gets real word
  boundaries.
- Handwriting is font-based (Caveat/Patrick Hand, OFL-licensed) with mask
  reveal — not per-glyph stroke tracing. Tegaki (already in the repo) remains
  an option for full glyph-stroke titles in a later iteration.
- Low-CPU machines: renders are CPU-bound; a 90s video takes several minutes
  on 2 cores. Fine for demos; the local worker is faster.
