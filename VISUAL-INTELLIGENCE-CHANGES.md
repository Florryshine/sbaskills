# Visual Intelligence System — change manifest

Shared Visual Discovery & Asset Intelligence for all SBA video engines.
Workflow: FETCH → INSPECT → DECIDE → USE / ADAPT / CREATE → STORE IF WORTH KEEPING.

Full documentation: `docs/VISUAL-INTELLIGENCE.md`

## Files ADDED (all new, nothing overwritten)

```
lib/visual-intelligence/license-policy.js          hard license gates (NC/ND rejected, attribution captured)
lib/visual-intelligence/providers/http.js          shared fetch plumbing (timeouts, UA, never throws)
lib/visual-intelligence/providers/photo-providers.js     Pexels, Pixabay, Wikimedia Commons, Openverse
lib/visual-intelligence/providers/svg-providers.js       Openclipart (API) + SVG Repo/unDraw/Storyset/Open Peeps (manual import, no scraping)
lib/visual-intelligence/providers/three-d-providers.js   Poly Haven (CC0 API) + Sketchfab (token-gated downloads)
lib/visual-intelligence/providers/index.js          registry, per-provider isolation, candidate byte fetcher
lib/visual-intelligence/procedural.js              Tier D deterministic SVG generators (SBA Original CC0)
lib/visual-intelligence/inspect.js                 magic-number + sharp probe + Gemini vision inspection
lib/visual-intelligence/decide.js                  use/adapt/create/discard/no-match with explanations
lib/visual-intelligence/storage.js                 4 storage tiers, sha256 dedup, TTL purge, stats
lib/visual-intelligence/discover.js                discoverVisual() orchestrator (never throws)
app/api/admin/visual-intelligence/discover/route.js      admin: run the pipeline, see every candidate verdict
app/api/admin/visual-intelligence/save/route.js          admin: approve & store to permanent library (hard license gate)
app/api/admin/visual-intelligence/providers/route.js     admin: provider/credential/vision status
app/api/admin/visual-intelligence/ephemeral/route.js     admin: tier B listing + purge
app/api/admin/visual-intelligence/stats/route.js         admin: storage usage stats
app/api/visual-intelligence/discover/route.js      ENGINE SERVICE: optional, fail-safe discovery API (bearer token or admin session)
app/api/cron/visual-cache-purge/route.js           storage-hygiene cron (tier A + B expiry)
supabase/migrations/20261122120000_visual_intelligence.sql   idempotent additive migration (apply manually in Supabase)
scripts/visual-intelligence-tests.mjs              the 14-scenario test suite (node scripts/visual-intelligence-tests.mjs)
docs/VISUAL-INTELLIGENCE.md                        architecture, contracts, env vars, runbook
```

## Files MODIFIED (surgical, behaviour-preserving)

```
app/admin/visual-assets/page.js   existing Library tab + upload flow kept intact; added tabs:
                                  Discover External / Ephemeral / Providers / Storage
tsconfig.json                     ONE LINE: target es5 → ES2017. Fixes PRE-EXISTING
                                  `next build` failure (TS1501 unicode-regex errors in
                                  visual-learning-engine — committed code, unrelated to this feature).
vercel.json                       ADDED the daily visual-cache-purge cron entry.
```

## Deploy checklist

1. Commit & push these files to GitHub (Vercel deploys automatically).
2. Apply `supabase/migrations/20261122120000_visual_intelligence.sql` in the
   Supabase SQL editor (idempotent — safe on the current production DB).
3. Ensure env vars exist in Vercel (production already has the Gemini keys):
   - optional: `PEXELS_API_KEY`, `PIXABAY_API_KEY` (photo/video providers)
   - optional: `OPENVERSE_API_TOKEN`, `SKETCHFAB_API_TOKEN` (rate-limit/download headroom)
   - new: `VISUAL_INTELLIGENCE_API_KEY` — bearer token for engine/worker calls
     (falls back to `CRON_SECRET` if unset; admin session always works)
4. Verify: Admin → Shared Visual Asset Library → new tabs; run
   `node scripts/visual-intelligence-tests.mjs` against production env.

## Guarantees

- Engines that never call the service behave exactly as before (verified:
  test scenario 14 — no engine/worker/queue file touched).
- One provider's missing key or dead endpoint disables only that provider.
- Without a vision key, subject accuracy is reported `uncertain` — never guessed.
- License policy (NC/ND reject, attribution capture) is enforced server-side
  on every storage path; admins can only promote unknown licenses explicitly.
