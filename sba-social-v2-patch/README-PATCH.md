# Patch: wire Phase 1 to the real video/carousel/image engines

This patch does NOT rebuild anything. It connects Phase 1's content-factory
and publish pipeline to the video-engine, carousel-engine, and image-engine
that already exist on your machine (confirmed by reading the actual files
you uploaded), fixes one real bug, and closes the loop so rendered
carousels/videos actually show up as media on their drafts.

## Files in this patch

| File | What changed |
|---|---|
| `supabase/migrations/20260719_video_scripts.sql` | NEW table `video_scripts`, matching exactly what `narration.js`/`render.js`/`worker.js` already read and write. Adds `content_asset_id` so a finished render can link back to its draft. |
| `lib/carousel-engine/render.js` | FIXED — was calling `rename()` without importing it from `fs/promises`. Would throw on the first PNG/JPEG render. Also returns the list of rendered file paths (`files`), which the new `media-attach.js` needs. |
| `lib/content-factory/media-attach.js` | NEW — the actual glue. `attachCarouselMedia()` calls your real `generate.js` + `render.js`, uploads slides to Supabase storage, inserts `media_files` rows. `queueVideoScript()` inserts a `video_scripts` row for the worker to pick up. |
| `lib/content-factory/index.js` | MODIFIED — after inserting each generator's draft rows, calls the media-attach step if a row asked for one (via `_media`). Failure to attach media never rolls back the draft — it's reported the same way platform failures already are. |
| `lib/content-factory/generators/instagram.js` | MODIFIED — carousel row now attaches `_media: { type: 'carousel', slides }` so real slide images get rendered, instead of leaving `metadata.slides` as text only. |
| `lib/content-factory/generators/youtube.js` | MODIFIED — LLM now returns `segments` (array of `{text, visual_cue, stock_search}`) instead of one flat `script` string, because that's what `narration.js`/`render.js` actually require to sync narration to visuals per-segment. Attaches `_media: { type: 'video_script', segments }` to queue a real render. |
| `lib/content-factory/generators/tiktok.js` | Same fix as youtube.js. |
| `local-video-renderer/worker.js` | MODIFIED — on successful render, if the script row has a `content_asset_id`, inserts a `media_files` row so the video shows up on its draft in the review dashboard. Previously it only updated `video_scripts.video_url` and stopped there. |

## What to delete

- `local-video-renderer/worker.mjs` — byte-for-byte duplicate of `worker.js`. Keep one.

## Apply steps

1. Copy these files into `sbaskills-recovery` at the matching paths (overwriting the Phase 1 versions where they already exist).
2. Also copy your real `lib/video-engine/`, `lib/carousel-engine/`, `lib/curriculum-engine/`, `remotion/`, and `local-video-renderer/` folders into `sbaskills-recovery` — none of this patch works without them actually being present, and right now they only exist outside the repo boundary (see earlier discussion).
3. Run the new migration:
   ```
   supabase db push
   ```
   (or however you've been applying the others — same flow as `20260718_social_engine_v2.sql`)
4. Create a Supabase Storage bucket called `carousel-slides` (public read), same way `lesson-videos` was set up for the podcast/video engine. Without this bucket, `attachCarouselMedia()` will fail on upload.
5. `npm install` — confirm `@marp-team/marp-cli`, `uuid`, and the `@remotion/*` packages are all present (the carousel/video engines depend on them; check they're in `package.json`, not just installed locally).
6. Commit, push, deploy Phase 1 + this patch together this time — the patch is what makes Phase 1's carousel/video rows actually produce media, so shipping Phase 1 alone (without this) would leave those platforms silently empty.
7. Keep `local-video-renderer/worker.js` running locally (`node local-video-renderer/worker.js`) whenever you want YouTube/TikTok drafts to actually render — Vercel still can't run Remotion, that part hasn't changed.

## What's still NOT covered by this patch

- Facebook/Telegram/LinkedIn/X/Pinterest generators still don't attach any image — they were never wired to `image-engine.js`'s `fetchStockImage`/`createBrandedThumbnail` either. Same pattern as above would apply; not included here since you asked specifically about video + carousel.
- No UI changes — this is backend wiring only. The review dashboard (Phase 3) still needs to be built to actually show any of this.
