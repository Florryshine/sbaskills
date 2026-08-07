# Content Loop — Spec & Operating Guide

## Problem this solves
Every content-factory route (`/api/content-factory/generate`, the admin
panel) requires a human to open the dashboard, pick a knowledge asset, and
click generate. Nothing was ever wired to run on a schedule. Result:
posting frequency depended entirely on whether Shine had time to sit down
that day — the opposite of the "consistency" needed to grow subscribers.

## What was added
One new route: `app/api/content-factory/auto-loop/route.js`, wired into
`vercel.json` as a once-daily cron (`0 5 * * *` UTC = 6am WAT — chosen to
land safely before the first scheduled post of the day, Facebook at 7:30am
WAT).

Each run:
1. **Picks fresh topics** — up to `LOOP_TOPICS_PER_RUN` (default 2)
   `knowledge_assets` that haven't had Facebook/TikTok/YouTube/LinkedIn
   content generated for them in the last `LOOP_COOLDOWN_DAYS` (default 21).
   FIFO through the pool (oldest-untouched first), so it works through your
   whole topic library instead of hammering the same few assets.
2. **Generates** — calls the existing `runContentFactory()` for those
   topics, scoped to `facebook`, `tiktok`, `youtube`, `linkedin` only (not
   the full 9-platform set — this loop is scoped to the four platforms this
   month's push is about).
3. **Schedules** (only in `auto` mode — see below) at fixed WAT windows
   tuned for a Nigerian student audience:
   - Facebook 7:30am (before school/commute)
   - LinkedIn 9:00am, weekdays only (skips forward past any weekend slot)
   - TikTok 4:00pm (after school, peak Gen-Z scroll time)
   - YouTube 6:00pm (evening watch time)

   These are starting assumptions, not measured data — once each platform's
   own analytics show your actual best-performing hours, replace the
   `POSTING_WINDOWS_WAT` constants at the top of the route.

## Two modes — `LOOP_MODE` env var

- **`review` (default, and what ships in this patch)** — generates and
  saves drafts to `content_assets` exactly like manual generation. Nothing
  gets approved, no `publish_jobs` row is created, nothing publishes
  without you opening `/admin/social-engine` and approving it yourself.
  This is the safe starting point: you get a daily queue of fresh drafts
  waiting for a quick review pass instead of starting from a blank page,
  but a human still signs off on every post before it goes anywhere.

- **`auto`** — same generation step, but also auto-approves each draft and
  creates a scheduled `publish_jobs` row at the windows above. Fully
  hands-off: topics go in, posts come out on schedule, no dashboard visit
  required. Only switch to this once you've watched `review` mode output
  for a week or two and trust it unsupervised — a bad caption or wrong fact
  going out with zero review is a real cost a scroll-past ad isn't.

Set it in Vercel → Project → Settings → Environment Variables:
`LOOP_MODE=auto` (or leave unset / `review` for the safe default).

## Tuning knobs (all env vars, all optional)
| Variable | Default | What it controls |
|---|---|---|
| `LOOP_MODE` | `review` | `review` = drafts only, `auto` = auto-approve + auto-schedule |
| `LOOP_TOPICS_PER_RUN` | `2` | New topics pulled into the loop per day. Start low; raise once the queue proves reliable. |
| `LOOP_COOLDOWN_DAYS` | `21` | Minimum days before the same topic can be reused for social content |

## What this does NOT do (by design, for now)
- Doesn't touch Instagram/Telegram/X/Pinterest — those already existed
  before this patch and aren't part of this month's 4-platform push. Add
  them to `TARGET_PLATFORMS` in the route file if you want them in the loop
  too — no other change needed, the generator registry already supports
  them.
- Doesn't do any cross-platform sequencing (e.g. "tease the YouTube video
  as a TikTok clip two days later"). That's a reasonable next iteration
  once the base loop is running reliably — flag it if you want it spec'd
  next.
- Doesn't pull real per-platform analytics to adjust posting times
  automatically — `publish_analytics` already exists as a table but nothing
  populates it yet. Also a good next step once you have a few weeks of
  `auto` mode data to look at.

## Rollout suggestion
1. Deploy with default `review` mode.
2. Watch `/admin/social-engine` for a week — is the topic selection sane?
   Are FB/TikTok/YouTube/LinkedIn captions still on-voice? Any repeated
   topics you didn't expect (check `LOOP_COOLDOWN_DAYS` if so)?
3. Once satisfied, set `LOOP_MODE=auto` and stop manually approving — the
   loop keeps running, you just spot-check occasionally.
4. Raise `LOOP_TOPICS_PER_RUN` if 2/day per platform isn't enough volume for
   your growth target.
