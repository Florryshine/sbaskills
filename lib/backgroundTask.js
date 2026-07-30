// lib/backgroundTask.js
//
// Lets an API route return a response immediately while heavy work
// (parsing + PDF rendering + upload, in our case) keeps running behind
// it, instead of the client's fetch() having to stay open until
// everything finishes.
//
// - On Vercel, a serverless function is normally frozen the instant it
//   sends its response, which would kill any "fire and forget" promise
//   mid-flight. Vercel (and Next's own `after()`) solve this with a
//   `waitUntil(promise)` primitive that keeps the function alive until
//   the promise settles (bounded by the route's `maxDuration`). Next
//   exposes it on a global set by its own request-context, so we don't
//   need the separate `@vercel/functions` package to use it.
// - On a persistent server (Render, `next start`, local dev) there's no
//   freeze-on-response behavior at all, so a plain un-awaited promise
//   already keeps running in the event loop — waitUntil is simply
//   unavailable there and unnecessary.
//
// Either way, the caller gets the same behavior: kick off `work()`,
// don't wait for it, and don't let a rejection crash the process.
export function runInBackground(work) {
  const nextRequestContext = globalThis[Symbol.for('@next/request-context')];
  const waitUntil = nextRequestContext?.get?.()?.waitUntil;

  const promise = Promise.resolve().then(work);

  if (typeof waitUntil === 'function') {
    waitUntil(promise);
  }

  // Always attach a catch so a background failure just gets logged
  // (and, in our case, recorded on the row via the caller's own
  // try/catch) instead of surfacing as an unhandled rejection.
  promise.catch((err) => {
    console.error('❌ Background task failed:', err);
  });

  return promise;
}
