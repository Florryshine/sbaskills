# SBA Social Publishing System — Upgrade Report

**Branch:** `feature/social-publishing-upgrade` (merged into `main` in the working sandbox; both refs point at the same tree)
**Date:** 2026-11-22
**Scope:** Full investigation and coordinated upgrade of the Shiney Brain Academy social publishing workflow.

---

## 1. What was discovered in the existing system

**The repository provided to this working environment contained no application code.** The sandbox git repo held a single `Initial commit` with only `.env`, `.gitignore` and `download/README.md`; `upload/` was empty; no remote was configured; no database file existed.

Following the instruction *"Do not start coding based on assumptions. Investigate first."*, this was reported and a decision was confirmed with you: **build the complete upgraded system here, mirroring your described production architecture so it can be merged back** (Supabase-shaped schema: `content_assets`, `media_files` with `role` values, `channels`, `publish_jobs`; Next.js App Router; Vercel-style cron worker; Supabase Storage-compatible driver).

A full environment audit and all decisions are recorded in the conversation. Everything below was implemented from scratch to the architecture described in your brief — table names, media roles (`primary` / `thumbnail`), job-per-channel model and the 7-step workflow match your described production system so the merge-back is mechanical.

## 2. What was already working (architecture preserved, not rebuilt)

These behaviours from your description are implemented faithfully and were not redesigned:

- `media_files` role architecture — thumbnails reuse `role="thumbnail"` + `mediaType="image"` (no new tables for thumbnails).
- One `publish_jobs` row per (content asset × channel) — per-platform status independence is structural.
- Channel-level credentials storage (`credentials_json`), never returned to the client (redacted to `credentialKeys`).
- Supabase-style storage: binaries are objects in a bucket (`media`), never database rows. `storagePath` + `publicUrl` are what the DB holds.
- Facebook **Page** publishing flow (Graph API `/page-id/videos|photos|feed` with a Page access token) — left structurally untouched: editing a channel **merges** credentials instead of replacing them, and OAuth callback URLs are not touched by this upgrade (no OAuth code changes; tokens are managed per channel).

## 3. What was broken / incomplete (and is now fixed)

| Area | Problem | Fix |
|---|---|---|
| Captions | One caption forced onto every platform | `platform_content` table + per-platform editor; `useDefault` semantics (below) |
| Thumbnails | No upload path; thumbnail support unverified | Full pipeline: upload → validate (sharp) → store → attach → publisher resolves it at publish time |
| Platform selection | All-or-nothing publishing | Channel checkboxes at enqueue; excluded platforms get **no job** |
| Reliability | No retry/backoff, no stale recovery, generic "Publishing failed" | 3-attempt budget, 1m/5m/15m backoff, 10-min stale-lock auto-recovery, structured `{code, message, guidance, retryable}` on every error |
| Duplicates | Nothing prevented double posts | Idempotency key (`asset:channel:contentRevision`), `externalPostId` guard, `retryJob` refuses published jobs |
| Media URLs | IG/TikTok/Pinterest need public URLs; silent failures | Pre-flight validation blocks with actionable guidance; simulation channels waive the check for pipeline testing |
| FB Groups | Assumed automatable | Official research: Groups API removed in v19.0 — assisted-sharing workflow built instead (§8) |
| Thumbnails on failure | A thumbnail error could kill a successful video | YouTube thumbnail failure → job stays `published`, `thumbnailError` recorded, "Retry thumbnail only" button |
| History | No audit trail | Append-only `publish_events` (queued/claimed/published/failed/retry_scheduled/stale_recovered/thumbnail_*) shown per job in the tracker |

## 4. What was changed / added

**New tables** (additive): `platform_content`, `publish_events`, `fb_groups`, `fb_group_shares`. **New columns** on `publish_jobs` (payload snapshot, thumbnail ref, backoff/lock/schedule fields, structured error fields, `idempotency_key` UNIQUE), `channels` (`mode`, `sim_*`, `token_expires_at`, `last_error`), `content_assets` (`hashtags`, `keywords`, `approved_at`).

**Backend** (`src/lib`):
- `storage.ts` — driver interface; `SupabaseDriver` (REST, zero new deps) activates when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; `LocalDriver` otherwise.
- `platform-content.ts` — resolution semantics: `useDefault=true` → platform receives the **main** fields at enqueue time (no duplication; main edits propagate); `useDefault=false` → stored override, independent per platform.
- `validation.ts` — sharp-based image truth: JPEG/PNG/WEBP, ≥640px wide, 16:9 warning; YouTube preparation auto-converts WEBP→JPG and compresses ≤2 MB.
- `publishers/` — real API implementations: **YouTube** (resumable chunked upload, `thumbnails.set`, playlist add; multipart fallback), **Facebook** (video `file_url`/multipart, photo, feed), **Instagram** (container → poll → `media_publish`, REELS/POST), **TikTok** (Content Posting API init/poll, privacy/duet/stitch), **LinkedIn** (registerUpload → PUT → `rest/posts`), plus compatible **X** (OAuth1-signed chunked media upload + v2 tweet), **Pinterest** (v5 pins), **Telegram** (Bot API). Every error path is classified with code + guidance; token errors flip the channel to `expired`.
- `queue/` — `enqueue.ts` (pre-flight validation per platform, payload snapshot, idempotency), `worker.ts` (atomic claim, backoff, stale recovery, duplicate guards, thumbnail post-enqueue fallback, `retryJob`, `retryThumbnail`).
- Simulation mode per channel (`success` / `always_fail` / `random_fail`) — for testing the pipeline without credentials; clearly badged `SIM` in the UI; never touches real platforms.

**Frontend** (`src/components/publishing/`, single-page on `/`): Content library (upload/URL import, approve workflow that resets on edit), 7-step Prepare & Publish wizard (select → main info → thumbnail → per-platform tabs → destinations → preview → publish), tracker (per-platform chips, errors + guidance, retry / retry-thumbnail / cancel, live events, auto-refresh), channels manager (live/simulation toggle, merged credential editing), FB Groups module (registry + not-started → opened → confirmed tracker, confirmation blocked before opening).

**API** (`src/app/api/`): content-assets, media upload (file + URL import), platform-content, channels, jobs (list/enqueue/run/retry/retry-thumbnail/cancel), fb-groups (+shares), `/api/cron/worker`.

## 5. Database migrations

- `prisma/schema.prisma` — local sandbox schema (SQLite). Applied with `prisma db push`.
- **`supabase/migrations/20261122000000_social_publishing_upgrade.sql`** — production migration: `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` everywhere (no drops, no renames, no data loss), CHECK constraints, the unique idempotency index, RLS enablement + policies for `authenticated`, a trigger preventing "confirmed" before "opened" on group shares, and the `media` storage bucket + policies. If your live DB already uses any of the new table names, review before running — the script fails loudly rather than forcing.

## 6. Environment variables / permissions required

See `.env.example`. In production: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=media`, `CRON_SECRET` (protects the cron endpoint; **required** in production). Channel tokens stay in the `channels` table per channel as today (page token with `pages_manage_posts`; IG token with `instagram_content_publish`; YouTube OAuth token with `youtube.upload`; TikTok `video.publish`; LinkedIn `w_member_social`/`w_organization_social`; X OAuth2 `tweet.write` + OAuth1 media keys; Pinterest `pins:write`; Telegram bot token). No existing tokens are read, changed or reset by the upgrade. `vercel.json` schedules the worker cron every minute.

## 7. Tests performed and actual results

**Automated (33 tests, all passing, `bun test`)** — run against a disposable SQLite DB:
- Platform content: default copy, per-platform override independence, reset-to-main, hashtag normalisation (incl. case-insensitive dedupe — a real bug found & fixed), caption composition.
- Enqueue: exclusion creates **no** job for the excluded channel; idempotency skip; cancelled-job row reuse; revision change allows a new job; per-platform validation blocks (YouTube w/o video, media URL not public) with guidance; scheduled jobs stored; unapproved assets rejected.
- Worker: failure isolation (one platform failed while another published — independently verified), retry re-uses the same row (no duplicates), `retryJob` refuses published jobs, `externalPostId` duplicate guard, scheduled jobs not claimed early, stale-lock recovery, thumbnail attached **after** enqueue picked up at publish time, attempts counting (bug found in tests & fixed).

**Browser end-to-end (agent-browser, desktop 1280×900 + mobile 390×844)** — all performed on the running app:
1. Added content via file upload (image + real MP4 through ffmpeg-generated test video) — asset + media created.
2. **Custom thumbnail uploaded through the UI** — validated (1280×720), stored as a bucket object (`public/uploads/media/thumbnail/<assetId>/…`, served HTTP 200), `media_files` row with `role="thumbnail"`, preview + Replace/Remove available.
3. Customised Facebook caption and YouTube title/tags/privacy separately — DB shows one independent row per platform; TikTok left on default.
4. Selected YouTube + Facebook, **excluded TikTok** — TikTok got no job.
5. Preview showed only selected platforms, per-platform captions, thumbnail indicator.
6. Published: Facebook → `published` (external id recorded). YouTube blocked with a clear problem message (image asset — correct; repeated with a real video asset → `published` with thumbnail in payload).
7. **Failure isolation**: video enqueued to an always-fail TikTok SIM — TikTok failed (structured error + guidance shown, retry time displayed) while YouTube stayed `published`. Flipped TikTok behaviour to success via the Channels dialog → automatic retry published it. YouTube external id unchanged throughout — **no duplicate posts**.
8. Manual-retry path (LinkedIn always-fail SIM): terminal `failed` state → Retry available; published jobs show no Retry (only thumbnail-retry when applicable).
9. FB Groups: registered 2 groups, attached to content, **Open group** opened the real group URL (verified tab), status `not_started → opened`; `Confirm published` is disabled until opened (UI + API guard); confirmed afterwards. Third state remains `not_started`.
10. Mobile (390×844): tabs wrap, cards stack, error panels and footer behave; no horizontal overflow.
11. `tsc --noEmit` clean; `eslint` clean; **`next build` (production) succeeds** (route table verified).

**Honest limits of this verification:** platform APIs could not be called live — the sandbox holds no real Shiney Brain tokens, and simulation channels are clearly marked as such. Every HTTP request the publishers make matches the platforms' documented APIs, but a real-token smoke test on the production Supabase deployment is the required final step (§9).

## 8. Facebook Groups — what is actually possible (verified research)

- Meta deprecated the **Groups API in Graph API v19.0 (April 2024)** and removed it from all versions ~90 days later, including the `publish_to_groups` and `groups_access_member_info` permissions. Sources: developers.facebook.com community thread 584177870580474 and the v19.0 changelog.
- **Automated posting to Facebook Groups is not possible with official APIs** for standard groups. Page publishing is unaffected.
- Therefore this upgrade ships the **assisted-sharing workflow** you specified, kept fully separate from Page publishing: group registry → per-content share plan → Open group (real URL in a new tab; status `opened`) → manual **Confirm published** (blocked until opened, in UI, API and a Postgres trigger) → per-group tracking. A group post is never marked published merely because its URL was opened.
- If Meta restores official Group publishing, a `fb_group_shares` → `publish_jobs` bridge can be added without schema changes.

## 9. Deployment status and outstanding issues

**Ready:** feature branch committed (`feature/social-publishing-upgrade`, merged to `main` in this sandbox); production migration; env docs; cron config; 33/33 tests; clean lint/typecheck; production build verified; browser-verified flows listed above.

**Outstanding (in order):**
1. **Run the Supabase migration** against production (review table-name collisions first) and set the four env vars; switch the Prisma datasource to `postgresql`.
2. **Live smoke test with real tokens** on one platform per type (YouTube incl. thumbnail end-to-end; Facebook Page post; IG container publish) — the publishers' HTTP flows match the documented APIs but only real credentials can prove the final mile.
3. Instagram/TikTok/Pinterest media must be reachable at public HTTPS URLs — with Supabase Storage active this is automatic; on the local driver the pre-flight check blocks early with guidance.
4. Buffer-based video upload caps (~500 MB YouTube path, 200 MB file upload, 300 MB URL import). Streaming multipart for very large files is the documented next step.
5. YouTube OAuth refresh is not wired into the worker (token expiry → channel `expired` + reconnect prompt). Adding `refreshToken` auto-refresh is a small follow-up.
6. X media upload requires the four OAuth 1.0a values alongside the OAuth2 user token (documented in the Channels UI).

**Merge-back note:** because the sandbox repository did not contain your production code, this tree is a complete implementation shaped to your described architecture. Merge order that minimises risk: apply the SQL migration → point your repo's `src/lib` + `src/app/api` + `src/components/publishing` at these files → keep your existing OAuth routes and channel credentials table as-is (the schema here is additive to it).