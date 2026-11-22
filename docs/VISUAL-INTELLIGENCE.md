# Shared Visual Discovery & Asset Intelligence System

Shared service that lets every SBA engine (Cartoon, Whiteboard, Stickman,
Notebook, Music Learning, Visual Learning, …) find, visually inspect, decide
on, and store reusable visual assets through one workflow:

```
FETCH → INSPECT → DECIDE → USE / ADAPT / CREATE → STORE IF WORTH KEEPING
```

Built **additively** on the existing shared `visual_assets` catalogue and the
`visual-assets` Supabase Storage bucket. No existing rendering engine, worker,
queue, or API contract was rewritten or broken (verified by
`scripts/visual-intelligence-tests.mjs`, scenario 14).

---

## 1. What was added

| Layer | Path | Purpose |
| --- | --- | --- |
| Provider modules | `lib/visual-intelligence/providers/` | Pexels, Pixabay, Wikimedia Commons, Openverse, Openclipart (automated APIs) + SVG Repo, unDraw, Storyset, Open Peeps (manual-import, no ToS-violating scraping) + Poly Haven, Sketchfab (3D/textures) |
| Inspection | `lib/visual-intelligence/inspect.js` | Byte/magic-number validation, sharp probing (real dimensions, actually-used transparency, blank detection), Gemini vision check (subject match, scientific accuracy, watermarks, style) |
| Decision engine | `lib/visual-intelligence/decide.js` | `use` / `adapt` / `create` / `discard` / `no-match` with score breakdowns and explanations |
| License policy | `lib/visual-intelligence/license-policy.js` | Hard gates: NC/ND rejected by default, attribution captured, unknown licenses = uncertain (admin review required) |
| Procedural library (Tier D) | `lib/visual-intelligence/procedural.js` | Deterministic SVG generators (concept card, gradient backdrop, labelled diagram card, icon badge, particle texture) — SBA Original CC0 |
| Storage tiers | `lib/visual-intelligence/storage.js` | Tier A search cache (TTL), Tier B ephemeral (TTL + purge), Tier C permanent library (`visual_assets`), Tier D procedural; sha256 dedup everywhere |
| Orchestrator | `lib/visual-intelligence/discover.js` | `discoverVisual()` — never throws; structured results or explicit `no-match` |
| Engine-facing service | `app/api/visual-intelligence/discover/route.js` | HTTP contract for engines and local renderer workers (bearer token or admin session) |
| Admin API | `app/api/admin/visual-intelligence/{discover,save,providers,ephemeral,stats}/` | External discovery, approve & store, provider status, ephemeral management, storage stats |
| Storage-hygiene cron | `app/api/cron/visual-cache-purge/route.js` | Purges expired Tier A cache rows and Tier B ephemeral files |
| Migration | `supabase/migrations/20261122120000_visual_intelligence.sql` | Idempotent, additive (see §3) |
| Admin UI | `app/admin/visual-assets/page.js` | Existing Library tab preserved; new tabs: Discover External, Ephemeral, Providers, Storage |
| Tests | `scripts/visual-intelligence-tests.mjs` | The 14 required scenarios (55 assertions) |

## 2. Provider status & credentials

| Provider | Mode | Env var | Notes |
| --- | --- | --- | --- |
| Pexels | API | `PEXELS_API_KEY` (required for provider) | Photos + videos. 200 req/h free tier. |
| Pixabay | API | `PIXABAY_API_KEY` (required for provider) | Search results cached **max 24h** per their API terms; assets re-hosted, never hotlinked. |
| Wikimedia Commons | API (no key) | — | Descriptive User-Agent per Wikimedia policy; per-file CC licenses pass the hard gate. |
| Openverse | API (no key) | `OPENVERSE_API_TOKEN` (optional, raises rate limit) | Machine-readable CC license data. |
| Openclipart | API (no key) | — | CC0 1.0 clipart via official JSON endpoint. |
| Poly Haven | API (no key) | — | CC0 3D models/textures/HDRI via official API. |
| Sketchfab | API | `SKETCHFAB_API_TOKEN` (optional; downloads are token-gated) | Only downloadable models surfaced; per-model licenses gated. |
| SVG Repo | Manual import | — | No public API → no scraping (ToS). Admin downloads & uploads via Library tab. |
| unDraw | Manual import | — | unDraw license; no public API. |
| Storyset (Freepik) | Manual import | — | Attribution required; no public API. |
| Open Peeps | Manual import | — | CC0; no public API. |

Modularity guarantee: a provider with missing credentials or a failing
endpoint disables **only itself**. Discovery continues with the rest, and the
admin Providers tab shows exactly what is configured/missing.

Vision inspection reuses the platform's existing Gemini keys
(`GEMINI_API_KEY` / `GEMINI_API_KEY_1..3`). **Without a vision key, subject
accuracy is reported as `uncertain` — never guessed.** Candidates still reach
the admin Discover tab for manual visual approval.

## 3. Database migration (idempotent & additive)

`supabase/migrations/20261122120000_visual_intelligence.sql`

- Creates `visual_assets` **only if missing** (identical shape to the existing
  cartoon-foundation definition) — safe whether or not
  `20261120080000_cartoon_studio_foundation.sql` was applied.
- Adds to `visual_assets`: `approval_status`, `provider`, `provider_asset_id`,
  `inspection`, `tier` — all `add column if not exists`.
- New tables: `visual_search_cache` (Tier A), `visual_ephemeral_assets` (Tier B).
- New RPC: `increment_visual_asset_usage(uuid)` (service-role only).
- RLS policies mirror the existing admin pattern; service-role grants; buckets
  inserted `on conflict do nothing`.
- No existing column, constraint, engine table, or policy is dropped or altered.

**Apply manually** in the Supabase SQL editor (repo convention: migrations are
not auto-applied). Re-running is a no-op. Production apply status: **not
verifiable from this environment** (needs Supabase dashboard/service access).

## 4. Engine integration (optional, fail-safe)

Engines keep their current pipelines. To opt in, call the service from a
route/worker:

```js
// In-process (same Next.js server):
import { discoverVisual } from '@/lib/visual-intelligence/discover';
const result = await discoverVisual({
  subject: 'red blood cells',
  sceneDescription: 'close-up of cells flowing through a capillary',
  kinds: ['illustration', 'photo'],
  style: 'scientific illustration',
  transparent: false,
  scientificAccuracy: 'strict',
  targetEngine: 'cartoon',
  renderJobRef: job.id,          // ties ephemeral retention to the render
  persist: 'ephemeral',          // 'none' to skip storage entirely
});
// result.decision: 'use' | 'adapt' | 'created' | 'no-match'
// result.asset.url / result.asset.svg, result.license, result.storage,
// result.adaptations, result.explanation
```

```bash
# HTTP (local renderer workers on the render box):
curl -X POST https://<deployment>/api/visual-intelligence/discover \
  -H "Authorization: Bearer $VISUAL_INTELLIGENCE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"subject":"human skeleton","kinds":["illustration","svg"],"targetEngine":"whiteboard"}'
```

Contract guarantees for engine authors:

- The endpoint **always answers 200** with a structured JSON body — internal
  failures degrade to `{ ok:false, decision:'no-match' }`, never a 5xx crash.
- `no-match` results include `fallback: 'text'` and per-candidate rejection
  reasons, so engines can fall back to their existing behaviour.
- Auth is fail-closed: `VISUAL_INTELLIGENCE_API_KEY` (preferred) or
  `CRON_SECRET` as bearer token, or an admin session cookie. No anonymous use.
- Engines that never call the service behave exactly as before.

## 5. Storage tiers & lifecycle

| Tier | Where | Lifecycle |
| --- | --- | --- |
| A — Search cache | `visual_search_cache` + short JSON | TTL per provider (Pixabay ≤ 24h). Purged by cron. |
| B — Ephemeral media | `visual-assets/ephemeral/*` bucket prefix | Default 7 days (renders may pass `retainUntilSeconds`); dedup by sha256; cron purge deletes rows + bytes. |
| C — Permanent library | `visual_assets` + `visual-assets/library/*` | Admin-approved only; full provenance (provider, source URL, creator, license, attribution, inspection record). |
| D — Procedural | Code generators; outputs stored in C with `source='procedural'`, `tier='procedural'` | SBA Original CC0 — safe to persist on creation. |

Dedup: content sha256 at every write path. Duplicate uploads/staging re-point
to the existing row instead of storing a second copy.

## 6. Admin usage

Admin → Shared Visual Asset Library now has five tabs:

1. **Library** — unchanged behaviour (search + manual upload with dedup).
2. **Discover External** — enter a subject, pick visual types / style /
   scientific-accuracy / transparency, run the FETCH → INSPECT → DECIDE
   pipeline. Every candidate shows provider, preview, subject-match score,
   license verdict, adaptation notes and rejection explanations. Approve &
   save stores into the permanent library (license policy enforced server
   side; unknown licenses need explicit confirmation).
3. **Ephemeral** — active/expired staged files, manual purge button.
4. **Providers** — credential status per provider, vision availability,
   manual-import guidance for no-API sources.
5. **Storage** — library counts/bytes by type & source, ephemeral usage,
   active cache entries.

## 7. Cron setup (recommended)

Add a Vercel cron entry to keep storage clean (uses the existing
`CRON_SECRET` auth pattern):

```json
{ "path": "/api/cron/visual-cache-purge", "schedule": "0 3 * * *" }
```

## 8. Running the tests

```bash
node scripts/visual-intelligence-tests.mjs
```

Covers the 14 required scenarios (car photo, skeleton, red blood cell,
mitochondrion SVG, lab background, rejection, adaptation, creation, library
reuse, dedup, provider failure, missing credentials, ephemeral cleanup,
engine regression). Checks that cannot run without credentials/network/
Supabase env are reported as SKIP with reasons — never silently passed.

Latest local run: **55 passed, 0 failed, 3 skipped** (skips = no Supabase
service credentials in the sandbox).

## 9. Honest limitations

- **Production DB state unverified**: the migration has not been applied from
  this environment; apply it in the Supabase dashboard and re-run the suite
  with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set.
- **Live E2E with keys**: Pexels/Pixabay/Gemini paths run only when their env
  vars are present (they are in production; they were not in this sandbox).
- **Pre-existing build fix included**: `tsconfig.json` target `es5 → ES2017`
  (one line). Without it, the repo's own `visual-learning-engine` TypeScript
  fails `next build` type-checking with TS1501 (unicode regex flag) — a
  pre-existing error on committed code, unrelated to this feature.
- **Manual-import sources** (SVG Repo, unDraw, Storyset, Open Peeps) surface
  license guidance in the admin UI instead of automated fetching, because they
  publish no official API and scraping would violate their terms.
