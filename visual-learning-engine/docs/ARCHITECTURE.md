# Visual Learning Engine — Architecture

A fully free, end-to-end educational-video production pipeline for Shiney Brain
Academy: **topic → script → scene-by-scene narration → shot illustrations →
animated composition (Ken Burns camera cuts, word-synced headlines, motion
graphics) → procedural background music → final MP4**.

Modeled on the psych-edu explainer style (bold ALL-CAPS headlines with a single
accent word, hand-drawn flat-cartoon illustrations on warm paper, gentle camera
motion, clean motion graphics), while staying flexible across subjects,
audiences, aspect ratios, durations and narration voices.

The engine deliberately follows the established engine/worker/route/UI pattern
of `whiteboard-engine` v3 and `stickman-engine` so ops stay identical:
durable Supabase job queue + claim RPC + heartbeats, a Bun worker in
`local-video-renderer/`, Remotion rendering, and the content_assets/media_files
save contract with optional Social-Engine auto-publish.

## Pipeline (worker stages)

```
queued ─► scripting ─► imagery ─► narrating ─► timeline ─► rendering ─► saving ─► done
              │            │           │
              ▼            ▼           ▼
        planner.js    providers.ts  providers.ts
        (LLM chain    (multi-shot   (edge-tts → tts-proxy →
        + template     image chain)  z-ai sandbox) with real word
        fallback)                    timestamps, else proportional
```

Every stage saves its artifact into the job row (`script`, `image_manifest`,
`narration_manifest`, `timeline`) so an interrupted job **resumes at the stage
that failed** instead of starting over, mirroring stickman-worker.

## The shot model (pacing)

Scenes are filmed in **shots**: one image never stays on screen longer than
`maxShotSeconds` (default **3 seconds**, configurable 1.5–10).

- Shot count per scene = `ceil(estimatedSceneDuration / maxShotSeconds)`,
  estimated from the narration word count (150 wpm) — computed before TTS so
  imagery prep can run in parallel.
- Consecutive shots vary the camera: close-up → wide → overhead → detail…
  (`SHOT_VARIATIONS`), with alternating Ken Burns direction per shot, so the
  carousel reads like camera cuts over one story beat.
- Compare scenes keep exactly two images (left/right) — the A/B is the point.
- Text-card scenes (list/process/quote/recap/outro) are graphic cards by
  design, matching the reference channel.

## Image providers (all free)

| Provider | Key | Use |
| --- | --- | --- |
| Pollinations (flux) | none | AI illustrations, style-locked prompts, seeded; watermark strip cropped |
| Pexels | `PEXELS_API_KEY` (free, already in GitHub secrets) | stock photos |
| Pixabay | `PIXABAY_API_KEY` (free, already in GitHub secrets) | photos + `image_type=illustration` for flat graphics |
| Wikimedia Commons | none | photos/diagrams/SVG, UGC-licensed |
| Openverse | none | CC-licensed images/graphics (best-effort; anonymous rate limits) |
| Engine-drawn SVG card | none | deterministic offline fallback, always succeeds |

Rotation order is style-aware and interleaved so a throttled AI can never
collapse an episode into repeated fallback cards: cartoon/sketch alternate
AI (shots 0/2) with stock (pixabay illustration graphics, wikimedia, openverse);
photo leads with stock. Stock queries are strict 2-keyword searches (Commons/
Openverse AND all terms — longer queries return zero results) and media
downloads send the descriptive `ShineyBrainAcademy/1.0 (https://…; contact: …)`
User-Agent, because generic/browser UAs get 403-blocked by Wikimedia. AI seeds
spread widely per scene/shot (prime multiples) and shot prompts vary CONTENT
(different metaphor/moment per shot), not just camera angle; the SVG fallback
card is derived from scene+subject (6 compositions × 6 palettes) so even a
total provider outage shows varied visuals. Every asset records provider,
prompt, seed and dimensions in the manifest (auditable + reproducible).

## 100% free operation — no paid APIs anywhere

| Need | Solution | Key required |
| --- | --- | --- |
| Script writing | `lib/llmFallbackChain.js` (Gemini/Groq free tiers, already the platform standard) **or** the deterministic template architect (`script/architect.ts`) when no keys exist | optional |
| Narration TTS | ① `edge-tts-universal` (free MS Edge voices, real word-boundary timestamps, works from residential IPs) ② the platform's free public edge-tts proxy (`TTS_ENDPOINT`) ③ z-ai sandbox TTS (dev) ④ timed silence for mute render | none |
| Illustrations | shot chain above | none |
| Background music | procedural generator (`music/generator.ts`): slow ambient chord pads, per-episode seeded, rendered to WAV in-process | none |
| Motion/animation | Remotion (MIT) with the platform's existing Chrome | none |
| Audio mixing | ffmpeg (loudnorm narration, volume-envelope ducked music) | none |
| Rendering host | GitHub Actions worker (same as stickman/whiteboard) or local machine | none |

## Package layout (`visual-learning-engine/`)

```
src/
  types.ts               job/spec types
  script/schema.ts       episode script JSON schema + validation + repair
  script/architect.ts    deterministic script builder (no LLM, always available)
  imagery/providers.ts   multi-shot chain: pollinations → pexels/pixabay → wikimedia → openverse → svg
  imagery/style.ts       style presets, prompt builder, shot/stock query variations
  narration/providers.ts edge → proxy → zai → silent chain; word timings (real or proportional)
  narration/align.ts     proportional word alignment (port of whiteboard align.ts)
  music/generator.ts     procedural ambient bed → WAV (seeded, no deps)
  audio/mix.ts           ffmpeg loudnorm + silence helpers
  timeline/builder.ts    script + narration + images → deterministic frame timeline
  render/Root.tsx        Remotion root (compositions for 16:9 / 9:16 / 1:1)
  render/VLVideo.tsx     top-level composition: scenes, transitions, captions, progress bar, music
  render/scenes/*.tsx    scene grammars: Hook, Title, Statement, Compare, List, Stat, Process, Quote, Recap, Outro
  render/ui.tsx          headline typography, ShotCarousel (≤3s/image), caption bar, badges
  render/cli.ts          `bun src/render/cli.ts --job job.json --out out.mp4` (bundle + render + audio mux)
  render/fonts.ts        font registration (Anton + Inter, OFL)
assets/fonts/            Anton-Regular.ttf, Inter-Variable.ttf (+OFL licenses)
```

## Scene grammar (script JSON)

Episode = `meta` + ordered `scenes`. Scene types (each with `narration`):

| type | layout | motion |
| --- | --- | --- |
| `hook` | giant headline + shot carousel | slow zoom, question mark pop |
| `title` | episode title card + hero carousel | reveal + accent underline draw |
| `statement` | headline + carousel + optional badges | Ken Burns + spring pop-ins |
| `compare` | split screen A/B with VS divider | divider slide, color-coded labels |
| `list` | numbered items revealed one-by-one | staggered slide-in, synced |
| `stat` | giant count-up number + context carousel | count + impact scale |
| `process` | step cards connected by arrows | progressive reveal |
| `quote` | quote card + author | paper card flip-in |
| `recap` | checkmark takeaways | sequential check draws |
| `outro` | outro card + CTA | pulse |

Word-synced captions use real timings from edge-tts, proportional otherwise.

## Deterministic timeline

`timeline/builder.ts` computes per-scene: narration start/end, scene frames
(narration duration + padding, clamped by min/max), transition frames,
Ken Burns params, shot lists, word→frame maps, and the music ducking
envelope. Same inputs → same timeline (no AI in this stage), which makes
preview (`@remotion/player` in the admin studio) and render byte-identical.

## Worker (`local-video-renderer/visual-learning-worker.js`)

Bun worker modeled on stickman-worker: `claim_visual_learning_job()` RPC
(SKIP LOCKED, stale-lease takeover, 3-strike poison pill), heartbeat lease
with `assertLease`, stage reporting, resume-from-artifact, liveness row in
`visual_learning_workers`, dispatch attempts table. Renders with
`bun visual-learning-engine/src/render/cli.ts --job … --out …`, uploads MP4 to
the `lesson-videos` bucket, saves script/timeline/preview assets to
`visual-learning-assets`, and records into `content_assets` +
`media_files` (asset_type `creator_video`) — which feeds the existing
Social Engine review/publish flow unchanged. `VISUAL_LEARNING_AUTO_PUBLISH=0`
disables auto-queueing.

## Supabase (`supabase/migrations/20261119_visual_learning_jobs.sql`)

`visual_learning_jobs`, `visual_learning_workers`, `visual_learning_dispatch_attempts`
+ `claim_visual_learning_job()` — same shape as the stickman engine tables.

## API + UI

- `app/api/admin/visual-learning/route.js` — POST create job (topic, audience,
  tone, target length, aspect, voice, style, music/subtitles toggles, shot
  pacing, key points, optional pasted script), GET list + status + worker
  liveness, PATCH cancel/retry.
- `app/admin/visual-learning/page.js` — studio: form (with image pacing
  selector), job list with live stage badges, and a `@remotion/player` preview
  of the produced timeline (`VisualLearningComposition.jsx` mirrors the
  whiteboard/stickman studios). Sidebar entry in `components/AdminSidebar.js`.

## Verifying

- Engine self-test renders a real episode offline:
  `bun src/render/cli.ts --selftest`
- Worker scenario: `bash local-video-renderer/tests/run-visual-learning.sh`
  (fake Supabase in-process, 14 scenarios → MP4 on disk).
- QC: ffmpeg loudness probe + frame extraction for visual check.
