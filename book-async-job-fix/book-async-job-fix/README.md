# Async book-PDF generation (fixes the 504 at 35k-45k words)

## What changed and why

The 504s weren't really about word count — they were about the browser's
`fetch()` to `/api/admin/books/from-text` having to stay open the entire
time the PDF rendered. Any proxy/timeout in front of that request (Vercel's
function `maxDuration`, or a platform gateway timeout) has a ceiling, and
once your book's render time crossed it, you got a 504 regardless of what
number you set.

The fix: the route now returns almost instantly with a `bookId`, and the
actual parse → render-to-PDF → upload work happens **after** the response,
in the background. The `books` row itself is the job record: it moves
`queued → processing → ready|failed`. The frontend polls a small status
endpoint every 3s until it's done, then shows the PDF link — no chunking,
no merging, still one continuous document, one PDF.

## Files (copy into your repo at these exact paths)

- `lib/backgroundTask.js` — new. `runInBackground()` helper: uses
  Vercel's `waitUntil` mechanism when deployed on Vercel (keeps the
  function alive after the response, up to `maxDuration`), and falls
  back to a plain fire-and-forget promise everywhere else (Render,
  `next start`, local dev), where there's no freeze-on-response issue
  to work around in the first place.
- `lib/pdf/processBookGeneration.js` — new. The actual parse/render/
  upload logic, extracted out of the route so it can run as a
  background job. Behavior is unchanged from before.
- `app/api/admin/books/from-text/route.js` — replaces your existing
  file. Creates/updates the book row as `queued`, kicks off
  `processBookGeneration` via `runInBackground`, returns immediately.
- `app/api/admin/books/[bookId]/status/route.js` — new. `GET` returns
  `{ status, fileUrl, error }` for a book row.
- `app/admin/books/from-text/page.js` — replaces your existing file.
  Same UI, but now polls the status endpoint instead of waiting on one
  long request, and shows "Queued…" / "Rendering PDF…" while it works.
- `supabase/migrations/20260730_book_generation_jobs.sql` — run this in
  the Supabase SQL editor. Adds `generation_status` (default `'ready'`,
  so existing books aren't affected) and `generation_error` to `books`.

## Deploy notes

- `maxDuration = 800` is set in the route as the ceiling for the
  background render on Vercel. That number only matters on Vercel, and
  only up to what your plan actually allows (Hobby is capped at 60
  regardless of what's in the code; Pro up to 300; Pro + Fluid Compute
  up to 800). Set it to your real plan ceiling.
- If you're actually deployed on Render (a normal persistent Node
  server, not serverless), `waitUntil` isn't relevant — the background
  work just keeps running in the event loop after the response is
  sent, so this works there without any extra config. The one thing to
  check on Render is that *its own* reverse-proxy/load-balancer request
  timeout isn't tripped — but since the response now comes back in
  well under a second, that's no longer a concern either.
- No new dependencies needed — `runInBackground` reads the same
  `@next/request-context` global that `@vercel/functions`' `waitUntil`
  and Next's own `after()` use internally, so nothing new to `npm
  install`.

## Testing

1. Run the migration.
2. Deploy these files.
3. Generate a 45k-50k word book from `/admin/books/from-text`. You
   should see the button switch to "Queued…" then "Rendering PDF…"
   within a few seconds, and the page will show the finished PDF link
   once it's ready — no 504, however long the render actually takes.
