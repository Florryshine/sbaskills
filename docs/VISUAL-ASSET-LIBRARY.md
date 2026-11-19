# Shared Visual Asset Library — Implementation Documentation

A single, engine-independent visual asset library for Shiney Brain Academy:
the system **creates its own SVG illustrations programmatically** and
**retrieves suitable free stock images** — with hard dedup, full licence
tracking, and an intelligent discovery pipeline that every production
engine (Cartoon Animation Studio, Whiteboard Studio, Notebook Studio, …)
shares.

Free-first by design: **zero mandatory paid APIs, zero subscriptions.**

---

## 1. What was built (mapped to the requirements)

| Req | Delivery |
| --- | --- |
| **A. SVG generation** | Deterministic built-in catalog of **70 hand-crafted generators** (organs, cells, microorganisms, plants, animals, molecules, science objects, educational diagrams, objects, 800×450 backgrounds) + an **AI SVG generator** (z-ai SDK, free) for anything off-catalog. Output is sanitised, self-contained, scalable SVG with an accessibility label. |
| **B. Stock retrieval** | **Openverse + Wikimedia Commons (no API key)** always-on; **Pexels, Pixabay, Unsplash** activate automatically when their free-tier key is present in `.env`. Search, preview, licence check and one-click import through one normalised API. Licences/attribution are captured per import — never assume "free = unrestricted". |
| **C. Asset storage** | `visual_assets` table in the **existing** Prisma/Supabase data model + files under `public/visual-assets/` (sandbox) which map 1:1 to a Supabase Storage bucket in production. Every asset stores: name, description, subject, category, keywords, asset type, file location, source, licence (+ URL + attribution flag + pre-filled credit), creator, dimensions, file size, content hash, generation params, usage count, creation date. |
| **D. Intelligent discovery** | `discoverAsset()`: **library first** (scored, word-boundary search) → **local SVG generation** (catalog; LLM optional) → **stock retrieval** (auto-import opt-in, otherwise candidates for review) → **graceful fallback** to a generic library asset. The cartoon pipeline calls it automatically per scene. |
| **E. Shared infrastructure** | Lives in `src/assets/` (NOT inside any engine). One table, one API (`/api/assets/*`), one UI (`/assets`). First consumer wired in: the Cartoon Animation Studio (auto-attach per scene + manual scene panel). Other engines consume the same API — no per-engine asset databases. |
| **F. Cost** | Local SVG generation is the primary path (free, instant, offline). Stock is optional and key-free by default. The engine stays fully functional with **no network at all**: library + catalog generation always work. |

## 2. Architecture

```
src/assets/
├── svg/
│   ├── kit.ts               pure SVG builder kit (ink, gradients, sticker style,
│   │                        minifier for stable hashing, no filters)
│   ├── catalog.ts           70-entry generation catalog with discovery metadata
│   └── generators/
│       ├── biology.ts       heart, brain, lungs, eye, ear, stomach, liver,
│       │                    kidneys, tooth, bone/joint, neuron, animal/plant
│       │                    cell, bacteria, blood cells, virus, mitochondrion,
│       │                    DNA, amoeba
│       ├── nature.ts        tree, flower, leaf, seedling, mushroom, sunflower,
│       │                    bird, fish, butterfly, frog, bee, cat, snail
│       ├── science.ts       H2O/CO2/O2/CH4, atom, flask, beaker, test tubes,
│       │                    microscope, magnet, thermometer, bulb, Saturn,
│       │                    sun, moon, earth, rocket, compass
│       ├── diagrams.ts      water cycle, photosynthesis, food chain, states of
│       │                    matter, butterfly life cycle, parts of a plant
│       └── objects.ts       books, pencil, globe, clock, abacus + 8 backgrounds
│                            (sky, classroom, space, underwater, forest, city,
│                             laboratory, farm — 800×450 scenes)
├── server/                  NODE-ONLY code
│   ├── storage.ts           public/visual-assets file store, sha256, SVG sizing
│   ├── library.ts           create+hard-dedup, scored search, idempotent seeding,
│   │                        metadata edit, delete, usage counting, stats
│   ├── svgLlm.ts            LLM SVG generation + strict sanitiser (no scripts,
│   │                        handlers, external refs, foreignObject; tag-balance check)
│   ├── stock.ts             provider registry, normalised candidates, import
│   └── discovery.ts         the decision engine + per-scene auto-attachment
└── ui/AssetLibrary.tsx      the admin library page (browse/search/filter,
                             detail+edit, generate, stock, discovery dialogs)

src/cartoon/engine/scenes/assetProps.tsx   renders library assets inside
                                           scenes (spring pop-in, float, shadow)
src/app/assets/page.tsx                    mounts the library at /assets
src/app/api/assets/*.route.ts              REST API (see below)
```

**Storage model.** Files live in `public/visual-assets/<slug>.<ext>` so the
Next Player *and* the Remotion render bundle reach them the same way as
cartoon narration audio (`mediaSrc()`/`staticFile()`). In sbaskills the same
relative paths become Supabase Storage paths (`visual-assets` bucket);
only `storage.ts` changes.

**Dedup (no wasted storage).** Every create hashes the normalised content
(SVG whitespace-collapsed) with sha256 → `contentHash @unique`; a second
provider-level key (`source`+`sourceRef`) stops re-importing the same stock
photo. Duplicates return the existing row (`duplicate: true`) and nothing is
written. Re-seeding the catalog stores 0 new rows — verified in tests.

## 3. Intelligent discovery — the decision order

```
discoverAsset({topic, subject, keywords, category,
               allowGenerate=true, allowLlm=false, allowStock=false})
1. ensureCatalogSeeded()            idempotent, local, instant
2. library search (scored)          name > keywords > subject > description,
                                    word-boundary matches, usage-boosted
3. nothing? → generate locally      catalog always available; LLM when enabled
4. nothing? → stock (optional)      prefer CC0/public-domain when auto-importing
5. still nothing? → generic         clearly-labelled fallback keeps engines alive
```

Every result carries a human-readable `notes[]` trail explaining the decision,
so an administrator can always see *why* an asset was chosen.

**Cartoon Studio integration.** After the storyboard is written, the pipeline
runs `discoverForScenes()` — one library/catalog asset per scene placed in a
layout-aware safe slot (never on the character band), licence copied into the
spec, usage counted. The studio's scene panel lets admins re-run discovery,
attach library assets manually, or detach. A render-time integrity pass drops
assets whose files vanished (a deleted asset can never stall a render).

## 4. API surface (all behind `requireAdmin()`)

| Route | Purpose |
| --- | --- |
| `GET /api/assets` | search/list + stats + provider key status (auto-seeds catalog) |
| `POST /api/assets` | import from dataURL or remote URL with licence metadata |
| `GET/PATCH/DELETE /api/assets/[id]` | detail / edit metadata, regenerate catalog SVG, mark used / delete |
| `GET/POST /api/assets/generate` | catalog listing / `{mode:"catalog"\|"llm"}` generation |
| `GET/POST /api/assets/stock` | provider status / `{action:"search"\|"import"}` |
| `POST /api/assets/discover` | run the discovery decision engine |
| `POST /api/assets/seed` | idempotent (re-)seed of the built-in catalog |
| `POST /api/cartoon/projects/[id]/attach-assets` | per-scene attach/detach/auto for the studio |

## 5. Licensing — how providers are respected

| Provider | Key needed | Licence recorded | Attribution |
| --- | --- | --- | --- |
| Local catalog / LLM SVG | — | "SBA Original (CC0)" | none required |
| Openverse | **no** | e.g. "BY 2.0", "CC0" | required unless CC0 (pre-filled) |
| Wikimedia Commons | **no** | Commons licence metadata | required unless PD/CC0 |
| Pexels | free key | "Pexels License" | appreciated, not required |
| Pixabay | free key | "Pixabay Content License" | appreciated, not required |
| Unsplash | free key | "Unsplash License" | requested (flagged required) |

The library never treats "free" as "no conditions": `attributionRequired`
assets show an amber warning in the UI and travel with a ready-to-paste
credit line. Auto-import prefers CC0/public-domain when the engine imports
without human review. Uploader-supplied licences (upload/API import) are
recorded verbatim — the admin asserts the right to use what they upload.

## 6. Graceful degradation (requirement F)

* No network / providers down → search returns per-provider status
  (`no-key` / `error` / `timeout`); the UI shows it; **discovery continues**
  via library + local generation (tested).
* No API keys configured → keyed providers are skipped with a hint; the two
  no-key providers (Openverse, Wikimedia) still work (tested live).
* LLM unavailable → catalog generators still cover ~70 subjects.
* Library empty → auto-seeds on first API call.
* Asset deleted after being placed in a scene → render-time integrity pass
  removes it; the video still renders.

## 7. Costs

| Item | Cost |
| --- | --- |
| 70 built-in SVG generators (local, deterministic) | 0 |
| AI SVG generation (existing z-ai SDK usage) | 0 |
| Openverse + Wikimedia search/import | 0 |
| Pexels / Pixabay / Unsplash (optional free tiers) | 0 |
| Storage (files + rows, dedup enforced) | existing infra |
| New paid dependencies | **none** |

## 8. Porting to sbaskills (file-by-file)

| Sandbox file | Goes to | Notes |
| --- | --- | --- |
| `src/assets/svg/**` | `lib/visual-assets/svg/**` | pure TS, copy as-is |
| `src/assets/server/*` | `lib/visual-assets/*.js` | `storage.ts` becomes the Supabase Storage adapter (upload/getPublicUrl/remove); `library.ts` swaps Prisma for the existing supabase client; everything else unchanged |
| `prisma` VisualAsset model | `docs/supabase migration` | `visual_assets` table SQL in `docs/supabase-cartoon-studio-migration.sql` |
| `src/app/api/assets/**` | `app/api/visual-assets/**` | swap `requireAdmin()` → `requireAdminApi()` |
| `src/assets/ui/AssetLibrary.tsx` | `app/admin/asset-library/page.js` | add AdminSidebar entry |
| Cartoon integration | already mirrored in `remotion/cartoon-studio/**` | `assetProps.tsx` + spec field |

## 9. Verified in this environment (actual results)

* 70/70 generators produce well-formed, sanitised SVGs (script smoke test).
* Seeding: 70 created on first pass; second pass `created: 0` (dedup holds).
* Re-importing identical content and the same stock photo → duplicate detected.
* Discovery: "The human heart and how it pumps blood" → **library: Human Heart**;
  off-catalog topic → **fallback with explanatory note**; word-boundary fix
  verified ("join" no longer matches "Joint").
* Stock: Openverse live search returned CC-licensed NASA/photographer images
  **without any API key**; full import stored 1024×464 JPEG (181 KB) with
  `BY-NC-ND 2.0`, creator, source URL, attribution. Re-import deduped.
* AI generation: "A cute cartoon volcano erupting" → sanitised 3 KB SVG in ~14 s.
* End-to-end: Photosynthesis project rendered 51.6 s 9:16 MP4 (12.7 MB) with
  library assets animated inside scenes (frame extraction verified);
  Chemical Reactions project picks different assets (molecules/lab) —
  different topics → different videos.

## 10. Known limitations (honest list)

1. Catalog SVGs are hand-authored — coverage is broad but not infinite; the
   LLM path fills gaps when enabled (needs the z-ai SDK to be reachable).
2. Stock auto-import during automated production is **off by default**
   (licence-safe); with it enabled, licence quality depends on the provider
   response — CC0-preferred ordering mitigates but a human review UI exists.
3. 3D asset support is storage/metadata-level (`.glb`/`.gltf` import +
   preview); no engine renders 3D yet.
4. Backgrounds are static scenes (they layer with the cartoon engine's own
   parallax worlds; they don't animate internally as files).
5. Text inside diagram SVGs uses a generic font stack — exact face varies by
   platform (kept to short bold labels).
6. usageCount reflects attachments/discoveries, not final publish counts.
