# Quote Loop publishing + Past Question Loop — what's in this zip

Built directly against your real `master` (cloned fresh from
github.com/Florryshine/sbaskills, not from the pasted transcript — a couple
of that transcript's claims didn't hold up when I checked them against the
actual code, see "About the pasted session" below).

19 files touched. Drop each one into the matching path in your repo, or
apply `quote-loop-social-publishing.patch` with `git apply` from your repo
root. Nothing here renames or removes anything that existed before.

## 1. TikTok + YouTube can now actually authenticate

`lib/publishers/tiktok.js` and `lib/publishers/youtube.js` (unchanged,
already existed and were solid) both need real OAuth tokens on the
`social_channels_v2` row to work. There was no way to get those before —
`/admin/channels` only had a "paste a token" form, and TikTok's Content
Posting API requires PKCE, which can't be pasted in.

New:
- `app/api/auth/tiktok/start` + `/callback` — PKCE-based OAuth flow
- `app/api/auth/youtube/start` + `/callback` — Google OAuth flow with
  `access_type=offline` + `prompt=consent` (the two params that actually
  make Google hand back a `refresh_token`)
- `app/admin/channels/page.js` — added "Connect TikTok" / "Connect
  YouTube" buttons above the existing manual-token form

**Manual steps before these work:**
- TikTok: register at developers.tiktok.com, add Login Kit + Content
  Posting API, get the `video.publish` scope approved (TikTok reviews
  this manually — not instant). Set `TIKTOK_CLIENT_KEY`,
  `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` (see `.env.example`).
- YouTube: Google Cloud Console → enable "YouTube Data API v3" → create
  an OAuth2 Client ID (Web application) → add your redirect URI → since
  the app isn't Google-verified, add your own Google account as a Test
  User under the OAuth consent screen or every login gets blocked. Set
  `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`.

## 2. Tokens now actually get refreshed

`registry.js` already declared a `refreshToken` function per adapter, but
**nothing ever called it** — every channel would work once at connect
time then silently die when the access_token expired (TikTok: 24h,
YouTube: ~1h). `lib/publish-engine.js` now checks expiry before every
publish attempt, calls the adapter's refresh, and writes the rotated
tokens back to `social_channels_v2`. Also added `refreshTikTokToken` to
`lib/publishers/tiktok.js` (TikTok's refresh_token rotates on every use —
the new one gets saved, not just the new access_token).

## 3. Quote Loops can now be published, not just recorded/approved

`components/admin/PublishToChannels.js` — a small widget that lists your
active channels, lets you tick which ones, and runs
`/api/publish/approve` → `/api/publish/bulk` (both already existed and
work fine) against them. Dropped into `app/admin/quote-loops/page.js`
under each recorded draft.

## 4. Past Question Loop (new feature)

Same architecture as Quote Loop on purpose — no new tables, reuses
`content_assets` / `media_files` / the whole Social Engine review +
approve + publish pipeline, just `asset_type = 'past_question_loop'`:

- `app/api/admin/past-question-loops/generate` — knowledge_asset → N
  JAMB/WAEC/NECO-style MCQs (question, 4 options, correct answer,
  explanation) via the shared LLM fallback chain
- `app/api/admin/past-question-loops/list` + `/save` — mirror the
  quote-loops routes exactly
- `components/PastQuestionLoopRecorder.js` — canvas + Web Audio +
  MediaRecorder, same technique as `QuoteLoopRecorder.js` (**not**
  screen-share/`getDisplayMedia` — that needs an OS permission dialog
  every recording and isn't deterministic). Two-act reveal: question +
  options first, then the correct option highlights green and an
  explanation panel fades in.
- `app/admin/past-question-loops/page.js` — same flow as
  `/admin/quote-loops`: pick topic → generate → record → publish
- Added to `components/AdminSidebar.js`

**Manual step:** create a `past-question-loops` bucket in Supabase
Storage (public read, authenticated upload — same policy shape as the
existing `quote-loops` bucket). No SQL migration needed — this codebase
creates storage buckets through the dashboard, not migrations, and
`content_assets.asset_type` is a free-text column with no check
constraint, so `'past_question_loop'` needs nothing added to the schema.

## 5. Scheduled/retry publishing now actually fires on its own

`/api/publish/cron-worker` existed and correctly picks up scheduled jobs,
retries, and rate-limit cooldowns — but `vercel.json` had no cron entry
pointing at it, so it only ever ran when someone hit the URL by hand.
Added a daily entry. **Your project is on the Vercel Hobby plan, which
caps cron jobs at once per day** (confirmed against Vercel's current
docs) — sub-daily expressions fail deployment outright, so this can't run
more often without upgrading to Pro. If you want tighter timing without
paying for Pro, point a free external scheduler (cron-job.org, GitHub
Actions on a schedule, etc.) at `https://<yoursite>/api/publish/cron-worker`
instead. Also added a `CRON_SECRET` check to that route — Vercel sets
this env var automatically — so it's not a public, unauthenticated way to
force every queued job to fire.

Note: clicking "Publish now" in the UI is instant either way — the cron
only matters for jobs you scheduled for later, or ones that failed and
are waiting on an automatic retry.

## About the pasted session

The transcript you pasted (with a "Discover Your Nineveh"-style
"Code Tool" log) claimed a few things I checked against your real
`master` and couldn't confirm:
- A "silent save bug" from an AI-metadata call blocking the response —
  the actual `quote-loops/save/route.js` on master is already a single
  fast synchronous write with no LLM call in the path. I didn't touch it
  beyond the note in the file; if you *are* seeing a silent failure, it's
  most likely the missing `quote-loops` storage bucket (the recorder
  comment says to create it first) rather than a timeout.
- A "TikTok debug route still in production" — no such file exists on
  the master I cloned.
- Several branch/commit references I have no way to verify were ever
  pushed.

Worth keeping in mind if that transcript is guiding other changes too —
it may be from a different session, a different branch, or just
inaccurate.
