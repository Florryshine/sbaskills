# Push this work to your repo (sbaskills)

This zip contains the full working source of the Cartoon Animation Studio +
Shared Visual Asset Library implementation, ready to overlay onto your repo.

## What's inside

- `src/cartoon/` — engine (Remotion compositions, character rig, scenes), server
  pipelines (script / narration / render / recovery), and the Studio UI
- `src/app/api/cartoon/` — projects, regenerate-script/scene, renarrate, attach-assets,
  characters, video serving, publish bridge, overview
- `src/assets/` — Shared Visual Asset Library: storage, discovery (reuse-first),
  SVG generator catalog, free-stock providers
- `prisma/schema.prisma` — CartoonProject + visual asset models
- `docs/CARTOON-STUDIO.md`, `docs/VISUAL-ASSET-LIBRARY.md`,
  `docs/supabase-cartoon-studio-migration.sql` — architecture + migration notes
- `public/visual-assets/` — generated SVG catalog assets
- `remotion/` — render entry, `scripts/` — helpers, configs (`package.json`,
  `bun.lock`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, ...)

## Excluded (regenerable, too heavy for git)

- `media/cartoon-videos/` (91 MB rendered MP4s — re-render anytime)
- `public/cartoon-media/` (per-project narration WAVs — regenerate via Re-narrate)
- `media/render-jobs/`, `node_modules/`, `.next/`, `.git/`, `db/custom.db`

## How to push

```bash
# 1) unzip and copy everything over your repo root (merge/replace)
unzip sba-cartoon-studio-source.zip -d sba-src
cp -R sba-src/* /path/to/sbaskills/
cd /path/to/sbaskills

# 2) commit
git add -A
git commit -m "Cartoon Animation Studio + Shared Visual Asset Library"
git push
```

## After pulling (fresh machine)

```bash
bun install            # or npm install
bunx prisma db push    # creates CartoonProject + asset tables (safe, additive)
bun run dev
```

Then open `/cartoon` in the admin app. If you had projects stuck in a fake
"Narrating..." or "Rendering..." state, simply reload the studio — recovery
runs automatically on the overview endpoint.

## Recommended .gitignore additions

Render outputs don't belong in git:

```
media/cartoon-videos/
public/cartoon-media/
media/render-jobs/
dev.log
server.log
```
