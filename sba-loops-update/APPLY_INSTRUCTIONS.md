# SBA Loops Update — apply, push, deploy (all in one)

Bundles everything from this session:
1. Attention-grabbing prompt rewrite for quote-loops and past-question-loops (headline hook formulas, trap-first explanations)
2. New Countdown Loops feature (5 new files + sidebar entry)

8 files total, no schema/migration changes.

## One manual step before first use of Countdown Loops
Create a `countdown-loops` bucket in Supabase storage — public read, authenticated upload — same policy shape as your existing `quote-loops` and `past-question-loops` buckets. Do this before you record your first countdown draft (generation/editing works fine without it).

## Commands — run these from your repo root

You've been working from `C:\Users\DELL\sbaskills\sbaskills-clean` in cmd.exe, so:

```
cd C:\Users\DELL\sbaskills\sbaskills-clean
git apply all-changes.patch
git add -A
git commit -m "Attention-grabbing loop prompts + new Countdown Loops feature"
git push origin master
```

That push is the deploy — Vercel is already wired to auto-deploy on push to master (same as every other change this session), so nothing extra to run. Watch the build in your Vercel dashboard; it normally takes a minute or two.

## If `git apply` fails
Most likely cause: one or both prompt files were already hand-edited or a previous patch was partially applied. In that case, skip the patch and just copy the files from `repo-files/` on top of your repo (same folder structure — 6 of the 8 are brand new files so they can't conflict; only `app/api/admin/quote-loops/generate/route.js`, `app/api/admin/past-question-loops/generate/route.js`, and `components/AdminSidebar.js` overwrite existing files), then run the `git add` / `commit` / `push` steps above.

## What's in this update
- `app/api/admin/quote-loops/generate/route.js` — headline now must use one of 6 named hook formulas, varied per line in a batch
- `app/api/admin/past-question-loops/generate/route.js` — explanation now opens with the trap/stakes/reflex/myth before the correct reasoning; distractors instructed to be genuinely tempting
- `app/api/admin/countdown-loops/generate/route.js`, `list/route.js`, `save/route.js` — new loop type: "3 things costing you marks in X" countdown
- `components/CountdownLoopRecorder.js` — new canvas timeline (~10s countdown reveal)
- `app/admin/countdown-loops/page.js` — new admin page (generate → pick draft → record → publish)
- `components/AdminSidebar.js` — added the Countdown Loops nav entry
