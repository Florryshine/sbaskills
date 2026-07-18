# Social Engine v2 — Phase 1 delivery

This is the **foundation layer**: database schema, AI content-factory
fan-out, and the publishing engine (adapters + job queue + retries).
It does NOT include the Review Dashboard UI yet — that's Phase 3.
Nothing in this code path ever auto-publishes; every job starts as
`draft`, needs an explicit `approve` call, then an explicit `publish
now` or `schedule` call.

## 1. Install the new dependency

YouTube's adapter uses Google's official client:

```bash
npm install googleapis --save
```

## 2. Run the migration

Copy `supabase/migrations/20260718_social_engine_v2.sql` into your
Supabase project (SQL editor, or `supabase db push` if you use the
CLI). It only *adds* tables — nothing from your existing schema is
touched or dropped. The old `social_post_drafts` / `social_channels`
tables can stay as-is until you're ready to retire them.

## 3. Copy the code files

Merge these into your repo at the same relative paths:

```
lib/content-factory/          (new)
lib/publishers/                (new)
lib/publish-engine.js          (new)
app/api/content-factory/       (new)
app/api/publish/               (new)
```

None of these overwrite existing files — they're all new paths, so a
straight copy is safe.

## 4. Environment variables to add

```
# YouTube (get these from Google Cloud Console after creating an
# OAuth2 Client ID and enabling YouTube Data API v3)
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=

# TikTok (get these after TikTok approves your Content Posting API
# scope request — this review is not instant, expect a wait)
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

Instagram/Facebook/Threads/WhatsApp reuse the same Graph API app you
likely already have from the old `social-publisher.js`. X, LinkedIn,
Pinterest tokens go directly on the `social_channels_v2` rows (see
below) — no new app-level env vars needed for those beyond what you
already had.

## 5. Add a channel row per platform you want to publish to

There's no admin UI for this yet (Phase 3), so for now insert directly:

```sql
insert into social_channels_v2 (platform, label, account_id, access_token, refresh_token)
values ('instagram', 'Main', '<ig_business_account_id>', '<long_lived_token>', null);
```

Repeat per platform. `refresh_token` is only needed for YouTube today.

## 6. Add the cron worker to vercel.json

Your existing `vercel.json` has one cron already (`/api/daily-mentor`).
Add this entry alongside it — don't replace the array, append to it:

```json
{
  "path": "/api/publish/cron-worker",
  "schedule": "*/5 * * * *"
}
```

## 7. Try it end to end (no dashboard yet — use curl/Postman)

```bash
# 1. Generate drafts for a knowledge asset across all platforms
curl -X POST https://yourdomain/api/content-factory/generate \
  -H "Content-Type: application/json" \
  -d '{"knowledgeAssetId": "<uuid>"}'

# 2. Look at what got created
select * from content_assets where knowledge_asset_id = '<uuid>';

# 3. Approve one draft for one channel
curl -X POST https://yourdomain/api/publish/approve \
  -H "Content-Type: application/json" \
  -d '{"contentAssetId": "<content_asset_uuid>", "channelIds": ["<channel_uuid>"]}'

# 4. Find the publish_jobs row that created, then publish it
curl -X POST https://yourdomain/api/publish/now \
  -H "Content-Type: application/json" \
  -d '{"jobId": "<publish_job_uuid>"}'
```

## What's genuinely done vs. what still needs you

**Done and testable today:** Instagram (single image, carousel, Reels),
Facebook (native photo/multi-photo/video), Telegram (all media types),
LinkedIn (image/video upload), X (media + threads), Pinterest.

**Code is real but needs your one-time setup before it'll run:**
YouTube (needs your OAuth2 consent flow completed once, see comment
at the top of `lib/publishers/youtube.js`), TikTok (needs TikTok's
manual API review approval, see comment at top of
`lib/publishers/tiktok.js`).

**Not built yet, still needs code (Phase 2):** actual video
*rendering* (script → mp4) for YouTube Shorts/TikTok/Reels — the
generators produce scripts, but nothing renders them to video files
yet. Carousel *slide images* similarly need a template renderer (the
generator produces slide text/structure, not pixels).

**Phase 3, not started:** the Review Dashboard UI itself — the
Buffer-style screen with per-platform previews, edit-in-place, and
tick-to-publish. All the API routes it needs already exist above.
