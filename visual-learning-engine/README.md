# @sbaskills/visual-learning-engine

A fully free, end-to-end **Visual Learning Video Production Engine** for
Shiney Brain Academy: topic → script → scene-by-scene narration → shot
illustrations (multi-image carousel, **no image on screen longer than 3
seconds**) → animated composition (Ken Burns camera cuts, word-synced
captions, motion graphics) → procedural background music → final MP4.

Style target: the psych-edu explainer look (giant uppercase headlines with
one accent word, flat hand-drawn cartoon illustrations on warm paper, gentle
camera motion) — flexible across subjects, audiences, aspect ratios
(16:9 / 9:16 / 1:1), durations (30s–15min), styles (cartoon / photo / sketch)
and narrator voices.

## Free operation — no paid APIs anywhere

| Need | Solution |
| --- | --- |
| Script | shared LLM fallback chain (`lib/llmFallbackChain.js`, free tiers) → z-ai CLI (dev) → built-in deterministic `architectScript` (no keys, never fails) |
| Narration | `edge-tts-universal` (real word timestamps, residential IPs) → free public TTS proxy (`TTS_ENDPOINT`) → timed silence |
| Illustrations | **shot rotation** (≤3s per image): Pollinations AI (free flux, style-locked seeded prompts) → **Pexels** → **Pixabay** (illustration type) → **Wikimedia Commons** → **Openverse** (no key) → engine-drawn SVG scene cards |
| Music | procedural ambient generator (`src/music/generator.ts`, seeded, pure TS → WAV) |
| Render | Remotion + platform Chrome; ffmpeg loudness normalization |

Stock providers reuse the platform's existing free keys
(`PEXELS_API_KEY`, `PIXABAY_API_KEY`) — already wired to GitHub secrets.
Wikimedia and Openverse need no key at all.

## Quick start

```bash
cd visual-learning-engine && bun install
bun src/render/cli.ts --selftest --out selftest.mp4   # offline end-to-end proof
```

Full episode (worker-driven, from repo root):

```bash
bun install                                   # repo root deps
cd visual-learning-engine && bun install && cd ..
bun local-video-renderer/visual-learning-worker.js   # durable queue worker
```

Admin UI: `/admin/visual-learning` (queue jobs from a topic or paste a
script, live stage tracking, image pacing selector, @remotion/player preview
that matches the render exactly).

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full pipeline
design, scene grammar, shot model, worker reliability model and database
schema.

## Layout

- `src/script/` — schema/validation + deterministic architect
- `src/narration/` — free TTS chain with word timings + proportional alignment
- `src/imagery/` — style presets + multi-shot image provider chain
- `src/music/` — procedural ambient bed generator
- `src/timeline/` — deterministic frame builder (preview == render)
- `src/render/` — Remotion composition (`VLVideo`), scene components, shot carousel, CLI
- `assets/fonts/` — Anton + Inter (OFL)

## Tests

```bash
bash local-video-renderer/tests/run-visual-learning.sh   # 14 worker scenarios
```
