# Social Publishing Upgrade — Merge Guide

This branch carries the **Social Publishing System upgrade** (Shiney Brain Academy), built as a standalone mirror of the production architecture and verified there before being pushed here:

- 33/33 pipeline tests passing (bun test)
- TypeScript clean, ESLint clean, production build succeeds
- Browser E2E verified on desktop + mobile (thumbnail upload end-to-end, per-platform copy, exclusion semantics, failure isolation, safe retry with no duplicate posts, FB Groups assisted flow)

It is **fully additive**: everything lives under new paths (`src/...`) and does not modify or delete any existing sbaskills file.

---

## 1. What is in this branch

| Path (this branch) | Contents |
| --- | --- |
| `UPGRADE_REPORT.md` | Full upgrade report: findings, what was kept, bugs fixed, changes, test results, deployment steps |
| `SOCIAL_PUBLISHING_MERGE.md` | This guide |
| `.env.social-publishing.example` | The environment variables the upgrade needs |
| `supabase/migrations/20261122000000_social_publishing_upgrade.sql` | Backward-compatible DB migration (new tables + additive columns + RLS + storage policies + confirm-guard trigger) |
| `src/lib/` | Publishing core: 8 platform publishers (`src/lib/publishers/*.ts` incl. simulation channel), queue (`enqueue.ts`, `worker.ts` with idempotency keys, atomic claim, 1m/5m/15m backoff, 10-min stale-lock recovery), `platform-content.ts`, `validation.ts`, `storage.ts`, `api-helpers.ts`, `db.ts`, `types.ts` |
| `src/app/api/` | Routes: `channels`, `content-assets`, `media` (+`upload`), `platform-content`, `jobs` (list/enqueue/run/cancel/retry/retry-thumbnail), `fb-groups` (+`shares`), `cron/worker` |
| `src/components/publishing/` | UI: `PrepareWizard` (7-step: content → main info → thumbnail → platform copy → destinations → preview → publish), `PublishTracker`, `ChannelsManager`, `ContentLibrary`, `PlatformContentEditor`, `ThumbnailUploader` (1280×720 validation), `FbGroupsPanel` |
| `src/app/page.tsx`, `layout.tsx`, `globals.css` | Minimal app shell wiring the wizard + tracker (reference UI) |
| `tests/` | `worker.test.ts`, `enqueue.test.ts`, `platform-content.test.ts`, `validation.test.ts`, `preload.ts` |

## 2. Integration option A — zero-move (recommended first step)

sbaskills maps `"@/*": ["./*"]`. The upgrade code imports via `@/lib/...`, `@/components/...`. To run it as-is, give the `src/` tree priority in `tsconfig.json`:

```json
"paths": { "@/*": ["./src/*", "./*"] }
```

TypeScript/Next.js resolve the first existing candidate, so:

- `@/lib/publishers`, `@/lib/queue/worker`, `@/components/publishing/*` resolve into the new `src/` tree.
- Existing imports (`@/lib/auth`, `@/lib/supabase-admin`, ...) keep resolving from the repo root — untouched.
- One ambiguity: `@/lib/utils` exists in both trees (both are the standard shadcn `cn()` helper) — `src/lib/utils.ts` wins; they are functionally identical.

With option A you can immediately run the tests and mount the wizard on any route:

```tsx
import { PrepareWizard } from "@/components/publishing/PrepareWizard";
import { PublishTracker } from "@/components/publishing/PublishTracker";
```

Tests:

```bash
bun test tests/ --preload ./tests/preload.ts
```

## 3. Integration option B — full remap into the root layout

Deeper consolidation (do after option A is verified in production):

1. `src/lib/*` → `lib/*`. The TS publishers **supersede** `lib/publishers/*.js`: when copying, remove the old `.js` file in the same change (e.g. `git rm lib/publishers/facebook.js` when adding `lib/publishers/facebook.ts`) so module resolution stays unambiguous. Our `src/lib/publishers/index.ts` replaces their `registry.js`.
2. `lib/publish-engine.js` and `app/api/publish/` are the previous-generation pipeline. Either retire them once migrated, or adapt them to enqueue through `src/lib/queue/enqueue.ts` — do not run both pipelines against the same `publish_jobs` table.
3. `src/app/api/*` → `app/api/*`. Keep every existing OAuth/token route (`app/api/social`, `app/api/auth`, the separate Facebook/Instagram OAuth work) exactly as-is — the upgrade reads tokens from `channels` and never touches the OAuth flow.
4. `src/components/publishing/*` → `components/publishing/*`; mount the wizard/tracker into your admin area.
5. `src/app/page.tsx` / `layout.tsx` / `globals.css` are reference-only — do not replace your existing `app/page.js` shell with them.

## 4. Database migration

Run `supabase/migrations/20261122000000_social_publishing_upgrade.sql` in the Supabase SQL editor (or via the CLI). It is written to be **idempotent and backward-compatible**:

- New tables: `platform_content` (per-platform copy with `use_default` semantics), `publish_events` (event log), `fb_groups`, `fb_group_shares` (assisted Facebook Groups workflow).
- Additive columns only on existing `channels`, `content_assets`, `media_files` (role = `primary`/`thumbnail`), `publish_jobs`.
- RLS policies, storage-bucket policies, and a confirm-guard trigger that blocks confirming an FB Group share before it has been opened.
- Review before applying, as with any migration against a live database.

## 5. Environment variables

Copy `.env.social-publishing.example` values into Vercel/local env:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `CRON_SECRET` (protects `POST /api/cron/worker`)

## 6. Vercel cron

Merge this entry into the existing `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/worker", "schedule": "* * * * *" }
  ]
}
```

## 7. Facebook Groups limitation (by design)

Meta removed Groups publishing from the Graph API (v19.0, April 2024). The upgrade therefore ships an **assisted sharing workflow**: register the group → the panel opens the group/target → the creator confirms "posted" manually → the share is marked confirmed. Confirmation is blocked until the target has actually been opened (enforced by trigger and API guard).

## 8. Honest boundary

All platform publishers were verified in the mirror environment (mock/simulation channels + structural tests). The final step in production is a smoke test with real platform tokens, channel by channel, using the Tracker's per-platform status and error guidance.
