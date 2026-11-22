# Dynamic Motion Graphics Engine (Motion Graphics Studio)

Production-integrated motion graphics production engine for SBA. It turns a
script (or just a topic) into a fully composed, animated, sound-designed
video — kinetic typography, geometric systems, counters, data visualization,
particles, light effects, transitions, camera moves and a procedural
music/SFX bed, all rendered through the **existing Remotion infrastructure**.

It follows the established engine conventions exactly (Cartoon Studio /
Whiteboard / Stickman / Visual Learning) and reuses their infrastructure —
no competing queue, no second rendering stack.

---

## 1. Architecture

```
Admin UI (app/admin/motion-graphics)
   │  POST /api/admin/motion-graphics  {action:'create'}        (requireAdminApi)
   ▼
motion_projects (status queued) + motion_jobs (job_type 'direction')
   │  pg_cron sweeper → GitHub repository_dispatch 'motion-graphics-render'
   ▼
local-video-renderer/motion-graphics-worker.js   (GitHub Actions / Render / laptop)
   │  claim_motion_job() RPC → claim_token lease → heartbeat every 25s
   │
   ├─ direction:  lib/motion/*  → creative direction + scene plan (deterministic, seeded)
   │              script via lib/llmFallbackChain.js when source = topic
   ├─ narrating:  lib/podcastTTS.synthesizeLine per scene → motion-assets bucket
   │              (uploaded-track mode supported; timed-silence fallback if TTS fails)
   ├─ audio:      procedural music bed + SFX kit (lib/motion/audio/*, pure JS DSP)
   ├─ rendering:  bundle(remotion/index.js) → selectComposition('MotionGraphicsVideo')
   │              → renderMedia (same Remotion pipeline as CartoonVideo)
   └─ uploading:  lesson-videos bucket → content_assets (creator_video) → media_files
```

### Files added (nothing existing was modified except two additive registrations)

| Layer | File |
|---|---|
| Creative engine | `lib/motion/random.js`, `directions.js`, `script-analyzer.js`, `scene-planner.js`, `direction-engine.js`, `estimate.js` |
| Procedural audio | `lib/motion/audio/synth.js`, `music.js`, `sfx.js` |
| Remotion design system | `remotion/motion/theme.js`, `easing.js`, `transitions.js`, `camera.js`, `Background.jsx`, `Subtitles.jsx`, `layouts.jsx`, `MotionGraphicsVideo.jsx`, `elements/{Shapes,Particles,KineticText,DataViz}.jsx` |
| Composition registration | `remotion/Root.jsx` (adds `MotionGraphicsVideo` — additive) |
| Worker | `local-video-renderer/motion-graphics-worker.js` |
| API | `app/api/admin/motion-graphics/route.js` (GET/POST/PATCH/DELETE) |
| UI | `app/admin/motion-graphics/page.js`, `components/AdminSidebar.js` (one entry) |
| Database | `supabase/migrations/20261121000000_motion_graphics_studio.sql` |
| CI | `.github/workflows/motion-graphics-worker.yml`, `.github/workflows/motion-graphics-smoke.yml` |
| Fonts | `public/fonts/` (9 OFL display/body fonts added) |
| Tests | `local-video-renderer/tests/motion-variation-check.mjs` |

---

## 2. Creative intelligence (no repetition)

Every video gets its own visual language instead of a fixed template:

1. **Script analysis** (`script-analyzer.js`) — scenes are segmented into
   punchy beats; emphasis words, numbers, questions, lists, comparisons,
   processes and quotes are extracted per scene.
2. **Domain classification** (`directions.js`) — 11 domains (technology,
   money, science, danger, motivation, education, health, history,
   environment, people, generic) classified by weighted keyword evidence,
   plus mood signals (urgent / dramatic / playful / calm / hopeful).
3. **Visual direction selection** — each domain has 2–3 hand-designed
   direction variants (e.g. money → `gold-ledger`, `neon-ticker`,
   `mint-editorial`). A seeded weighted pick (biased by mood) selects one,
   giving palette, typography pairing, shape vocabulary, particle system,
   lighting, transition set, camera moves, motion personality, music kit
   and SFX kit. **The same script always reproduces the same direction;
   any change of script or seed drifts to a different one.**
4. **Scene planning** (`scene-planner.js`) — 14 layout archetypes
   (kineticHeadline, counterFocus, dataViz, splitCompare, flowSteps,
   staggerList, questionReveal, quoteCard, definitionCard, radialBurst,
   gridReveal, spotlight, timelineTrack, waveFocus) chosen by content
   signals with anti-repetition penalties (no layout twice in a row, decayed
   weights for recent layouts). Counters appear only where numbers exist;
   data viz only with real data.
5. **Audio direction** — music kit + tempo chosen by direction; scene cuts
   snap exactly to scene boundaries; a riser leads into every cut and an
   impact lands on it; the bed ducks under narration windows.

`visual_intensity` (calm / balanced / bold) scales layout density, motion
energy, particle counts and flash frequency. `music_style` can override the
direction's kit. Scene-level regeneration re-plans a single scene with a new
seed while preserving user-edited text.

---

## 3. Rendering

- One composition (`MotionGraphicsVideo`) registered in the shared
  `remotion/Root.jsx` with `calculateMetadata` — one bundle renders any
  orientation (`9:16`, `16:9`, `1:1`) and any duration.
- Scenes run as overlapping `Sequence`s; each boundary plays the planned
  transition (push / wipe / flashCut / scaleCut / glitchSlide / iris /
  shatter / split) with enter/exit transforms + overlay effects.
- Narration audio starts exactly at its scene boundary; per-scene SFX and
  the music bed are placed on the global timeline; subtitles are a single
  global track with per-word highlighting driven by narration word timings
  (real TTS timings when the provider returns them, weighted estimates
  otherwise).
- Jobs are claimed atomically (`claim_motion_job`, SKIP LOCKED, poison-pill,
  stale-lease takeover), guarded by `claim_token` leases, heartbeated every
  25s (`motion_job_heartbeat`), retried up to `max_attempts`, and every write
  checks lease ownership before saving — a zombie worker cannot overwrite a
  newer worker's state.

## 4. Database

Migration `20261121000000_motion_graphics_studio.sql` (additive, re-runnable):

- `motion_projects` — script/source, orientation/fps/intensity/music/narration
  settings, `direction` jsonb, `scenes` jsonb, `narration` jsonb, `audio_meta`
  jsonb, status lifecycle `draft → queued → directing → direction_ready →
  rendering → ready | failed`, video/url/size/duration, links to
  `knowledge_assets`, `content_assets`, `media_files`.
- `motion_jobs` — `direction` | `render` job types, claim/lease columns,
  `max_attempts`, `result`, `completed_at`.
- `motion_workers` + `motion_dispatch_attempts` — liveness + dispatch log.
- RPCs `claim_motion_job(text)` and `motion_job_heartbeat(...)` —
  security definer, service-role only (identical contract to cartoon).
- RLS: admin-only policies via `profiles.role = 'admin'`; workers use
  service role. Storage bucket **`motion-assets`** (public read) for
  narration/music/SFX artifacts; final MP4 goes to the shared
  **`lesson-videos`** bucket.
- Auto-dispatch: pg_net + Vault `github_dispatch_token` →
  `repository_dispatch event motion-graphics-render`, plus a
  `motion-graphics-renderer-sweeper` pg_cron job every minute.

Apply with the Supabase SQL editor or the existing migration flow.

## 5. UI (Motion Graphics Studio)

`/admin/motion-graphics` (sidebar entry under PUBLISHING):

- Create project: script **or** topic (AI script generation with
  deterministic fallback), format, intensity, music style, narration mode
  (AI voice-over / uploaded track URL / silent), SFX + subtitles toggles.
- Live stage stepper + progress while a worker runs (polling stops when
  idle), worker-liveness banner (90s threshold).
- **Direction review**: palette swatches, typography, music kit, SFX list,
  transitions + an in-browser `@remotion/player` preview of the exact
  composition before rendering.
- Scene editor: edit heading/narration text (durations re-estimated),
  regenerate one scene's composition, render settings (music style, SFX,
  subtitles), recent jobs, retry failed jobs, delete project.
- Final video playback + MP4 download, registered in `content_assets` /
  `media_files` like every other engine.

## 6. Testing

- `local-video-renderer/tests/motion-variation-check.mjs` (CI smoke):
  10 checks — scene completeness, layout anti-repetition, ≥4 distinct
  directions across 6 scripts, palette/type/music divergence, determinism,
  seeded regeneration, music-boundary alignment, music bed + SFX synthesis,
  non-empty scenes.
- Worker failure paths (claim loss, retries, poison pill) follow the same
  lease machinery proven by the Cartoon worker; TTS failure falls back to
  timed silence so a render never dies mid-pipeline because of one scene.

## 7. Deployment notes

1. Apply the SQL migration (creates tables, RPCs, bucket, cron sweeper).
2. Ensure repo secrets exist (same ones other render workers use):
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TTS_ENDPOINT`,
   `GEMINI_API_KEY`. The GitHub token in Vault (`github_dispatch_token`)
   already used by the whiteboard/stickman dispatchers works for this
   engine too.
3. Worker runs anywhere bun runs: GitHub Actions (workflow included),
   Render.com (add a service with the same command), or locally:
   `bun local-video-renderer/motion-graphics-worker.js`.
