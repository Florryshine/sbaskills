# APPLY CHANGES — Stickman Animation Engine

This package adds the Stickman Animation Engine to your sbaskills repository.
It is **additive**: no existing file is modified, no existing engine is touched.

## 1. Copy the files

From this package's root, copy into your repository root (same structure):

```
stickman-engine/                                  ->  stickman-engine/
supabase/migrations/20261118000000_stickman_engine_jobs.sql
app/api/admin/stickman-engine/route.js
app/admin/stickman-engine/page.js
local-video-renderer/stickman-worker.js
docs/STICKMAN_ENGINE.md
```

Or, from the ZIP root:

```bash
unzip stickman-animation-engine.zip -d /tmp/stickman-pkg
cp -r /tmp/stickman-pkg/sbaskills-stickman/. /path/to/sbaskills/
```

## 2. Apply the database migration

```bash
supabase db push
# or paste supabase/migrations/20261118000000_stickman_engine_jobs.sql
# into the Supabase SQL editor and run it
```

Creates: `stickman_jobs` table (admin RLS), `claim_stickman_job()` +
`stickman_heartbeat()` RPCs, `stickman-assets` storage bucket, queue index.

## 3. Dependencies

Nothing new is required. The engine uses the `remotion` / `react` versions
already pinned in your `package.json`, and narration uses the free TTS stack
(`lib/podcastTTS.js` -> Gemini / edge-tts fallback) already in your tree.

Optional for fully isolated local renders: `cd stickman-engine && bun install`.

## 4. Start the worker

Anywhere Chrome/Bun runs (your existing local-video-renderer host):

```bash
bun local-video-renderer/stickman-worker.js
```

Env needed (same as the whiteboard worker): `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. Optional: `CHROME_PATH`, `STICKMAN_WORKER_POLL_MS`.
The worker long-polls `stickman_jobs`, so no cron or GitHub dispatch changes
are needed. On Render.com, duplicate the whiteboard worker service and change
only the start command.

## 5. Use it

- Open `/admin/stickman-engine`. The friction-story sample is preloaded —
  press **Queue animation**.
- Watch the pipeline stages (queued -> narrating -> rendering -> ready) and
  play the MP4 in the page when it is ready.
- The finished video lands in the standard `lesson-videos` /
  `content_assets` / `media_files` contract, so the Social Engine can publish
  it to all your platforms with zero extra code.

## 6. Render the sample locally without Supabase (optional smoke test)

```bash
cd stickman-engine
bun src/render/cli.ts --job jobs/sample-job.json --out out/local-test.mp4
```

A pre-rendered copy ships as `stickman-engine/out/friction-story.mp4`
(74 s, 720x1280, H.264 + AAC narration).

## 7. Verify the build

```bash
npx next build          # unchanged repo behaviour + the new route/page
npx tsc --noEmit -p stickman-engine/tsconfig.json   # engine typecheck (clean)
```

## Notes

- The engine is a self-contained TypeScript package; it never imports your
  app code, so a build or type error inside it cannot break existing engines.
- To author new videos: SceneScript JSON (schema in
  `stickman-engine/src/rig/character.ts`), full example in
  `stickman-engine/scenes/friction-story.json`, authoring guide in
  `docs/STICKMAN_ENGINE.md`.
- To add actions/environments: see "Adding a new action" in
  `docs/STICKMAN_ENGINE.md`.
