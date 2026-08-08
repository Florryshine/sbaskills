# Teaching Loops v2 — browser-recorded, just like Quote Loops

Same idea as before, rebuilt the way you actually wanted it: **no Remotion,
no video_scripts, no laptop worker.** It works exactly like Quote Loops /
Past Question Loops — generate a script, click Record, your browser draws
it to a canvas and records it with MediaRecorder, you click Save. Nothing
renders on a server or on your laptop in the background; it renders live
in the admin page while you're looking at it.

The only difference from Quote Loops: instead of one 6-second clip, this
cycles through 10-14 short text cards over ~2 minutes, with an
Instagram-Stories-style progress bar at the top so it's clear how far
through the topic you are.

## You already applied the OLD (Remotion-based) version — undo that first

You ran `git am 0001-teaching-loops.patch` on branch `feature/teaching-loops`
already. That version is being fully replaced, not patched on top of. Undo it:

```powershell
git checkout main
git branch -D feature/teaching-loops
```

(If you'd already merged that branch into `main`, tell me instead of running
the above — we'll need to revert the merge commit rather than delete a branch.)

## Apply the new version

```powershell
git checkout -b feature/teaching-loops
git am 0001-teaching-loops-v2.patch
```

If `git am` complains about whitespace/line endings:

```powershell
git apply --reject --whitespace=fix 0001-teaching-loops-v2.patch
```

## One manual step before first use

Create a **`teaching-loops`** bucket in Supabase Storage — public read,
authenticated upload. Same exact policy shape as your existing
`quote-loops` bucket, so if you still remember how you set that one up,
do the same here.

## What's in this patch (7 files)
- **New:** `lib/content-factory/generators/teaching-loop.js` — the script prompt: 10-14 short text cards (hook → why it matters → teach it → common mistake → recap → CTA), sized to be read on-screen since there's no voiceover, plus a hold-time estimator that scales the whole script to ~2 minutes.
- **New:** `app/api/admin/teaching-loops/generate/route.js` — generates the script + picks ONE background (stock video, falls back to photo) for the whole clip.
- **New:** `app/api/admin/teaching-loops/list/route.js` — scoped list for the admin page.
- **New:** `app/api/admin/teaching-loops/save/route.js` — same save/approve/auto-publish pattern as `quote-loops/save`.
- **New:** `components/TeachingLoopRecorder.js` — the canvas + Web Audio + MediaRecorder component. Progress bar, one card at a time, continuous background zoom, background music from your existing `quote-loops` audio library.
- **New:** `app/admin/teaching-loops/page.js` — pick a topic → Generate → Record → Publish to Channels. Same layout as `/admin/quote-loops`.
- **Modified:** `components/AdminSidebar.js` — nav entry.

## How to use it
1. Open `/admin/teaching-loops`, pick a topic, click **Generate**.
2. Click **Record** on the draft — your browser plays through all 10-14
   cards over the background, capturing it live (~80-160s depending on
   how much text the script needed).
3. Click **Save** — uploads straight to Supabase storage, marks the draft
   approved, and queues publish jobs the same way Quote Loops does.
4. **Publish to Channels** appears once there's a recorded video.

No worker, no render queue, no waiting — what you see recording is what
gets saved.
