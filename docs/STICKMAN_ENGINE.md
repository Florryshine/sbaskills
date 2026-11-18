# Stickman Animation Engine — Integration Guide

A reusable skeletal-animation engine for storytelling and educational videos,
integrated into the sbaskills video platform. **Everything runs on free tools**:
programmatic vector animation (Remotion), free neural TTS (edge-tts via the
existing `lib/podcastTTS` stack), and the existing Docker render worker. No paid
AI video APIs anywhere.

## What you get

| Capability | How it works |
|---|---|
| Reusable characters | One rig per style (`src/rig/character.ts`); style = colors, head size, hoodie. Same cast renders consistently in every scene |
| Skeletal animation | Jointed 2D figures; FK chains for arms/head, analytic two-bone IK for legs and reaching hands (`src/rig/geometry.ts`, `src/motion/poses.ts`) |
| Walking / running | Procedural gait with **pinned stance feet** — feet cannot slide (`src/motion/walk.ts`) |
| Jumping / celebrating | Root-parabola hops with limb anticipation (`cheerStream`) |
| Sitting | Bench seat targeting with leg IK (`sitStream`) |
| Pointing / presenting | Hand IK to any world point or prop (`aimStream`) |
| Facial expressions | Emotion presets (talk/happy/worried/strain/surprised/proud) with brows, mouth shapes, sweat drops |
| Character interaction | Facing, talking, reacting, gesturing on shared word-timed beats |
| Object manipulation | Props with hand handles; push, walk-while-pushing, sliding physics curves |
| Environments | Street (buildings, clouds, road), abstract teaching space (floating subject icons), classroom — deterministic seeded vector sets |
| Camera | Establish / focus / follow / two-shot / shake + zoom-through & wipe transitions, all compiled to eased transforms (zero per-frame cost) |
| Narration sync | TTS durations + proportional word timings drive gesture beats, captions and scene lengths |
| Educational overlays | Screen-space force arrows, labels, formula cards that stay fixed during camera moves |

## Architecture (matches the whiteboard engine pattern)

```
admin page (app/admin/stickman-engine)
  -> POST /api/admin/stickman-engine        (validates SceneScript, queues stickman_jobs)
     -> stickman_jobs (Supabase)            claim_stickman_job() RPC, SKIP LOCKED leases
        -> local-video-renderer/stickman-worker.js (Bun)
             1. narrate: lib/podcastTTS.synthesizeLine() per dialogue line
                (files -> stickman-assets bucket + engine public/narration/)
             2. compile: stickman-engine/src/scene/compiler.ts
                SceneScript + durations -> dense deterministic timeline JSON
             3. render:  stickman-engine/src/render/cli.ts (Remotion, bun)
             4. save:    lesson-videos bucket + content_assets + media_files
                (video appears in the Social Engine, publishable to all platforms)
```

## File map (everything new lives in these paths)

```
stickman-engine/                              the engine package (self-contained)
  src/rig/{geometry,character}.ts             bones, IK solvers, styles, SceneScript schema
  src/motion/{poses,walk,idle,actions}.ts     pose builder, gait generator, action library
  src/scene/compiler.ts                       SceneScript -> timeline (pure function)
  src/render/{StickmanComposition.tsx,parts.tsx,index.tsx}
  src/render/cli.ts                           bun render CLI
  scenes/friction-story.json                  sample script (74s physics story)
  tools/gen_narration.py                      offline narration generator (edge-tts + ffprobe)
  public/narration/*.mp3                      sample narration audio
  jobs/sample-job.json                        ready-to-render sample job
  out/friction-story.mp4                      rendered sample (if you keep out/)
supabase/migrations/20261118000000_stickman_engine_jobs.sql
app/api/admin/stickman-engine/route.js
app/admin/stickman-engine/page.js
local-video-renderer/stickman-worker.js
docs/STICKMAN_ENGINE.md                       this file
```

## Install steps

1. **Database**: `supabase db push` (or run the migration in the SQL editor).
2. **Dependencies**: nothing new to install — the engine uses the same pinned
   `remotion` / `react` versions already in `package.json`. If you want an
   isolated install for local renders: `cd stickman-engine && bun install`.
3. **Worker env** (Render.com service or local): no new variables required.
   Optional: `CHROME_PATH=/path/to/chrome` if Chrome is not on PATH.
4. **Start the worker**: `bun local-video-renderer/stickman-worker.js`
   (long-polling; on Render.com add it as a second service entry pointing at
   the same Docker image, command `bun local-video-renderer/stickman-worker.js`).
5. **Use it**: open `/admin/stickman-engine`, the sample friction story is
   preloaded — press *Queue animation*.

## Render the sample locally (no Supabase needed)

```bash
cd stickman-engine
bun install                                  # or use the repo's node_modules
python3 tools/gen_narration.py               # regenerates free TTS (needs edge-tts + ffprobe)
bun src/render/cli.ts --job jobs/sample-job.json --out out/friction-story.mp4
```

Output: 720x1280 @ 30fps H.264 + AAC, ~74 seconds. A pre-rendered copy is
included at `out/friction-story.mp4`.

## Authoring a new video (SceneScript)

A video is a JSON document: cast (styles), scenes (positions, actions, props,
camera intents, overlays, dialogue). The compiler fills everything else —
poses, IK, easing, caption timing. See `scenes/friction-story.json` for a
complete example (8 scenes: running entrance, failed push, close-up with
friction arrow, bench conversation, force-arrow explanation, zoom-through to a
frictionless world, successful push, formula recap).

```json
{
  "title": "My lesson", "fps": 30, "width": 720, "height": 1280,
  "environment": { "type": "street", "seed": 7, "time": "day" },
  "cast": { "ben": { "style": "ben" }, "maya": { "style": "maya" } },
  "scenes": [{
    "id": "s1", "cast": { "ben": { "x": -380, "facing": 1 } },
    "actions": [{ "char": "ben", "do": "walk", "from": -380, "to": -100, "speed": 120, "t0": 0.2 }],
    "camera": [{ "do": "follow", "target": "ben", "scale": 2.0 }],
    "dialogue": [{ "who": "ben", "text": "Hello world!" }]
  }]
}
```

### Adding a new action (the extensibility path)

Actions are generators in `src/motion/actions.ts`: a function from
`(style, timing, params)` to a dense array of skeleton frames (joint
positions per frame) plus face events. Write the generator, add one `case`
in the compiler switch, extend the `SceneAction` union. Poses cross-fade
through `blendInto`, so new actions slot into existing scenes without pops.

## What was verified

- `tsc --noEmit` clean on the whole engine package.
- The bundled sample renders end-to-end through Remotion (`bun src/render/cli.ts`)
  producing the 74s MP4 included with this package; frames verified
  scene-by-scene (characters, props, arrows, captions, formula card).
- Job queue SQL mirrors the proven whiteboard pattern (claim/heartbeat/fail).
- Admin route/page/worker follow repo conventions (`requireAdminApi`,
  `createAdminClient`, `synthesizeLine`, `lesson-videos` storage contract).
- The worker and admin page are convention-cloned but were not executed
  against a live Supabase instance from this sandbox (no project keys here);
  the render path itself is fully verified. Run the worker once locally with
  your keys to close the loop.

## Known limitations

- Faces are minimal shapes (genre-correct); there is no phoneme lip-sync —
  speech is carried by gesture beats and captions.
- 720x1280 @ 30fps by default; 1080x1920 works but renders ~2.2x slower on CPU.
- Two vector environments ship in the sample (street + abstract teaching
  space); classroom kit is stubbed. New environments are seeded vector
  functions in `src/render/parts.tsx`.
