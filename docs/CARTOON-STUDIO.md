# Cartoon Animation Studio — Implementation Documentation

A production engine that turns Shiney Brain Academy Knowledge Assets into
colourful, narrated 2D cartoon videos — built free-first (zero recurring
cost) on React + Remotion + SVG.

---

## 1. What this is

An administrator picks a Knowledge Asset (or types a topic), and the studio:

1. writes a creative storyboard with an LLM (hook → teach → *journey inside
   the concept* → recap → CTA),
2. generates per-scene narration (TTS with **measured** durations and
   word timings),
3. composes animated scenes (jointed cartoon characters, 12 animated
   worlds, props, camera moves, transitions),
4. renders a real H.264 MP4 (9:16 priority, 16:9 and 1:1 supported),
5. saves it and registers it with the existing Social Publishing system.

Everything is a working engine — no placeholder videos, no fake buttons.

## 2. Architecture (mirrors the sbaskills whiteboard-engine patterns)

```
src/cartoon/
├── engine/                  PURE VISUAL CODE (no server deps, relative imports)
│   ├── types.ts             CartoonSpec schema + catalogs (expressions, actions,
│   │                        visual concepts, props, layouts)
│   ├── palette.ts           SBA brand + deterministic seeded randomness
│   ├── characters/
│   │   ├── CharacterRig.tsx Jointed SVG human (hip→knee→ankle, shoulder→elbow→hand),
│   │   │                    12 actions, 10 expressions, walk/run cycles with
│   │   │                    opposite-phase arm swing, continuous lip-sync
│   │   ├── face.tsx         10 expressions + word-timed mouth openness + blinking
│   │   ├── hair.tsx         9 hairstyles (afro-puff, braids, headwrap, buns…)
│   │   └── presets.ts       8 SBA characters + DNA resolver
│   ├── scenes/
│   │   ├── concepts.tsx     12 animated worlds: classroom, park, city, bloodstream,
│   │   │                    leaf-world, chemistry-lab, space, water-cycle, ocean,
│   │   │                    farm, stage, abstract (parallax, particles, life)
│   │   └── props.tsx        23 animated educational props
│   ├── fx/index.tsx         Speech bubbles, labels, confetti, sparkles,
│   │                        transitions (fade/slide/wipe/iris), camera, subtitles
│   └── CartoonVideo.tsx     Root Remotion composition (all ratios via
│                            fraction-based layout; scene durations = measured
│                            narration + pads; music + audio + subtitles)
├── server/                  NODE-ONLY CODE
│   ├── zai.ts               LLM JSON with tolerant repair + TTS (429 backoff)
│   ├── storyboard.ts        KA → validated storyboard (clamp to engine catalogs)
│   │                        + deterministic fallback storyboard
│   ├── narration.ts         TTS → WAV → measured duration + proportional word
│   │                        timings (static-served under /cartoon-media/)
│   ├── renderJob.ts         Spawns the render worker process, polls progress
│   └── pipeline.ts          Job lifecycle: stages, attempt caps, claim token,
│                            stale recovery, idempotent content_assets/media_files save
└── ui/                      The admin studio (single page, 7 steps)
    ├── StudioPage.tsx       Topic → Script → Cast → Audio → Render → Publish → Library
    ├── CharacterStudio.tsx  Cast browser + custom character creator (live rig)
    └── CharacterCanvas.tsx  Real engine rig rendered live in the browser

scripts/cartoon-render-worker.mjs   Standalone render process (bundle + Chrome +
                                    renderMedia → MP4, progress via JSON file)
remotion/index.jsx                  Remotion root registering the CartoonVideo composition
prisma/schema.prisma                cartoon_projects, cartoon_characters + the
                                    publishing contract (content_assets, media_files,
                                    social_channels, publish_jobs, publish_history)
docs/supabase-cartoon-studio-migration.sql   Supabase port of the schema
```

### Why the renderer is a separate process
Exactly like `local-video-renderer/whiteboard-worker.js` in sbaskills:
Remotion + Chrome Headless Shell must never enter the Next.js serverless
bundle. The API route writes a job file, spawns
`scripts/cartoon-render-worker.mjs`, and polls its progress file. In
production the same script becomes the worker loop (Render.com service /
GitHub Actions, identical to the whiteboard engine's deployment trifecta).

## 3. Data flow

```
KnowledgeAsset ─┐
custom topic  ──┴→ POST /api/cartoon/projects
                     └─▶ pipeline (background): scripting → narration → cast_ready
                          (spec JSON validated against engine catalogs; per-scene WAVs
                           under public/cartoon-media/<project>/, narration JSON with
                           word timings stored on the project row)
PATCH {action:"render"} ──▶ startRender(): claim token, attempt cap
                     └─▶ worker process: bundle → Chrome → renderMedia (h264)
                          progress% → DB heartbeat every ~1.2s
                     └─▶ on success: MP4 at media/cartoon-videos/<id>.mp4
                          + idempotent content_assets (asset_type='cartoon_video',
                            platform=null) + media_files (primary video row)
POST /api/cartoon/publish {action:"approve"|"publish"} 
                     └─▶ publish_jobs per channel → adapters
```

## 4. API surface

| Route | Purpose |
| --- | --- |
| `GET /api/cartoon/overview` | KAs + cast + channels for the UI |
| `GET/POST /api/cartoon/projects` | list / create (starts pipeline) |
| `GET/PATCH/DELETE /api/cartoon/projects/[id]` | status / edit spec / orientation / subtitles / `{action:"render"}` / delete |
| `POST …/regenerate-script` | fresh storyboard (replaces script + narration) |
| `POST …/regenerate-scene` | ONE scene via LLM (+ optional creative instruction), re-narrates only it |
| `POST …/renarrate` | re-TTS one scene or all |
| `GET /api/cartoon/video/[file]` | streams rendered MP4 (Range supported) |
| `GET/POST /api/cartoon/characters` | cast list / create-update custom DNA |
| `GET/POST /api/cartoon/publish` | publishing dashboard / approve+queue / execute / cancel |

All routes call `requireAdmin()` (see §7).

## 5. The engine catalogs (what the LLM may choose from)

- **10 expressions** — neutral, happy, excited, sad, angry, surprised, scared, confused, proud, sleepy
- **12 actions** — idle, talk, walk, run, jump, dance, point, wave, sit, think, cheer, shrug
- **12 visual concepts** — classroom, park, city, bloodstream, leaf-world, chemistry-lab, space, water-cycle, ocean, farm, stage, abstract
- **23 props** — book, apple, heart, leaf, flask, molecule, star, sun, cloud, blood-cell, magnifier, bulb, trophy, blackboard, droplet, rocket, backpack, ruler, globe, chair (auto-placed under sitting characters), oxygen/co2 bubbles, speech-plant
- **5 camera moves** — none, zoom-in, zoom-out, pan-left, pan-right
- **5 transitions** — fade, slide, wipe, iris, none

`validateStoryboard()` clamps every value (positions, scales, narration
length, enum membership) so the renderer can never receive an undrawable
spec. Chairs are auto-positioned under sitting characters.

## 6. Lip-sync & subtitles

z-ai TTS returns WAV without word timestamps, so the studio measures the
real duration from the WAV header and distributes words proportionally
(weighted by word length — the same approach as whiteboard-engine's
`proportionalWords`). Mouth openness is continuous (0..1, oscillating
within each word), subtitles reveal word-by-word from the same timings.
If a TTS provider with real word timings is configured (e.g. the
whiteboard engine's EdgeTTSProvider), drop the timings in
`narration.words` and everything downstream (lips, subtitles) upgrades
automatically.

## 7. Porting to sbaskills (file-by-file)

| Sandbox file | Goes to | Notes |
| --- | --- | --- |
| `src/cartoon/engine/**` | `remotion/cartoon-studio/**` | Pure visual code — copy as-is (TS works in the Next 14 build) |
| `remotion/index.jsx` | merge into `remotion/index.js` | Register `CartoonVideo` with `calculateMetadata` (duration from `totalDuration(props)`, size from orientation) |
| `src/cartoon/server/zai.ts` | `lib/cartoon/ai.js` | Replace `generateJson`/`synthesizeSpeech` with `lib/llmFallbackChain.generateWithFallback` + `lib/podcastTTS.synthesizeLine` (keep the repair parser — see §8) |
| `src/cartoon/server/storyboard.ts` | `lib/cartoon/storyboard.js` | Prompt + validator unchanged; presets import path update |
| `src/cartoon/server/narration.ts` | worker step | Upload WAVs to the `cartoon-assets` bucket; `audioUrl` = public Storage URL (absolute https URLs pass through `mediaSrc()` unchanged) |
| `src/cartoon/server/renderJob.ts` + `scripts/cartoon-render-worker.mjs` | `local-video-renderer/cartoon-worker.js` | Convert spawn→job-poll into the whiteboard worker's `claim` loop (claim cartoon_projects via `render_job_token`); upload MP4 to `lesson-videos/cartoon/<id>/<slug>.mp4` |
| `src/cartoon/server/pipeline.ts` | split: API route (enqueue) + worker (execute) | `registerWithPublishing()` already writes the exact sbaskills contract |
| `src/cartoon/ui/**` | `app/admin/cartoon-studio/page.js` + components | Replace `requireAdmin()` stub with `requireAdminApi()`; add AdminSidebar entry under PUBLISHING |
| `docs/supabase-cartoon-studio-migration.sql` | `supabase/migrations/` | New tables only; reuses KA + social tables |
| Prisma seed characters | SQL/seed script | Insert the 8 presets into `cartoon_characters` |

Publishing needs **no new code**: the studio writes `content_assets` +
`media_files`, and `/admin/social-engine` lists them automatically
(`platform = null` → all `VIDEO_CAPABLE_PLATFORMS` offered). Approve flow,
publish jobs, retries, rate limits and all 8 platform publishers work
unchanged. In the sandbox the adapters are simulated (no OAuth credentials
available); in production `executePublishJob()` posts for real.

## 8. Hard-won lessons (keep these in the port)

1. **LLM JSON needs repair, not just retry** — the model emits unescaped
   inner quotes, half-quoted hashtag arrays and bare `#tags`. The
   three-stage parser (direct → quote/newline repair → hashtag rebuild)
   took generation success from ~30% to 100% across test topics.
2. **Audio paths must go through `staticFile()`** — raw `/...` paths work
   in the Player but 404 inside the render bundle (`/public/` prefix).
   `mediaSrc()` handles both; absolute Storage URLs pass through.
3. **SVG elements need an `<svg>` root** — Chrome silently drops bare
   `<g>`/`<rect>` children of a div. Every fx component returns a full
   `<svg viewBox>` now (this bit twice: backgrounds, then fx).
4. **Measured durations, never estimates** — scenes cut to the voice
   because durations come from the WAV header.
5. **Bun/Next 16 vs repo (Node 24/Next 14)** — engine code is plain
   React + Remotion and compiles in both; server code uses only
   `child_process`, `fs`, `path`.

## 9. Costs

| Item | Cost |
| --- | --- |
| LLM storyboards (z-ai SDK) | 0 |
| TTS narration (z-ai SDK) | 0 |
| Music loops + SFX (synthesized, in `public/audio/`) | 0 (CC0-equivalent, self-made) |
| Scene illustrations (Shared Visual Asset Library — local SVG) | 0 |
| Fonts (Baloo 2, Nunito — OFL) | 0 |
| Rendering (own worker / Render starter / GH Actions) | existing infra, unchanged |
| New paid dependencies | none |

## 9b. Shared Visual Asset Library integration (section 7)

Every scene can now carry `customAssets` from the **Shared Visual Asset
Library** (`/assets`, `src/assets/`, one library for ALL engines):

* **Auto**: after the storyboard is written, `discoverForScenes()` picks a
  library asset per scene (library reuse first, then local SVG generation —
  never network-dependent) and places it in a layout-aware slot.
* **Manual**: the Script step's scene panel ("Library assets in this scene")
  supports re-running discovery, attaching from the library and detaching;
  licence metadata travels inside the spec.
* **Render-safe**: assets resolve through `mediaSrc()`/`staticFile()` in
  both the Player and the render bundle, and a render-time integrity pass
  drops assets whose file vanished.

Full documentation: `docs/VISUAL-ASSET-LIBRARY.md`.
Migration for sbaskills: `visual_assets` table + `visual-assets` storage
bucket in `docs/supabase-cartoon-studio-migration.sql` (section 7 addendum).

## 10. Known limitations (honest list)

1. **Sandbox channels are simulated** — no OAuth credentials exist here;
   the approve/queue/job/audit flow is real, the platform adapters are
   stubs that implement the same contract. In sbaskills the real
   publishers take over with no changes.
2. **Single voice** — z-ai TTS exposes one usable voice; characters get
   ±2% speed variation only. Gemini TTS (in sbaskills) supports multiple
   named voices — wire `CharacterDNA.voice` to `podcastTTS` voices.
3. **Word timings are proportional, not acoustic** — good lip-sync feel,
   not phoneme-accurate.
4. **Render concurrency** — one render at a time per worker (same as the
   whiteboard engine). Vertical throughput needs the multi-claim pattern.
5. **English narration only** — the engine renders any text, but no i18n
   voice mapping is configured.
6. **`regenerate-scene` re-narrates only when the text changed** — if the
   LLM returns identical narration, the old audio is kept (by design).
7. Render worker needs ~1.5 GB RAM for Chrome + 1080×1920 frames.
