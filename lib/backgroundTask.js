// lib/backgroundTask.js
//
// Lets an API route return a response immediately while heavy work
// (parsing + PDF rendering + upload, in our case) keeps running behind
// it, instead of the client's fetch() having to stay open until
// everything finishes.
//
// This used to read Next.js's internal
// globalThis[Symbol.for('@next/request-context')] symbol directly to
// get at waitUntil — but that symbol is only ever populated when Next's
// own `after()` request-context machinery is active, which on Next.js
// 14.x requires `experimental: { after: true }` in next.config.js. This
// project doesn't set that flag, so that lookup was silently returning
// undefined on every request — meaning none of the background jobs
// (this book-from-text PDF render, the podcast generators) ever
// actually got a lifetime extension. On Vercel, a serverless function
// is normally frozen the instant its response is sent; without a real
// waitUntil, the background promise was racing against that freeze —
// sometimes finishing a little before teardown, sometimes getting cut
// off mid-render and only resuming (from wherever the event loop had
// gotten to) the next time that same warm container happened to handle
// another request, e.g. the frontend's own 3s status poll. That's what
// turned a several-second render into several *minutes*: the actual
// working time didn't change, but it was now fragmented across
// whatever incidental traffic happened to keep the container warm,
// instead of running start-to-finish in one go.
//
// @vercel/functions' waitUntil is the officially supported, stable way
// to do this — it doesn't depend on Next's internal experimental
// request-context wiring at all, and works the same regardless of Next
// version or whether `experimental.after` is configured.
import { waitUntil as vercelWaitUntil } from '@vercel/functions';

export function runInBackground(work) {
  const promise = Promise.resolve().then(work);

  try {
    // No-ops harmlessly outside a real Vercel invocation (e.g. local
    // `next dev`, or `next start` on a persistent server) — there's no
    // freeze-on-response behavior there anyway, so the un-awaited
    // promise above already keeps running in the event loop on its own.
    vercelWaitUntil(promise);
  } catch (err) {
    console.warn('waitUntil unavailable in this environment — background task will still run, just without a guaranteed lifetime extension:', err.message);
  }

  // Always attach a catch so a background failure just gets logged
  // (and, in our case, recorded on the row via the caller's own
  // try/catch) instead of surfacing as an unhandled rejection.
  promise.catch((err) => {
    console.error('❌ Background task failed:', err);
  });

  return promise;
}
