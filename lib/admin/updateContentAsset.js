// lib/admin/updateContentAsset.js
//
// Thin client-side wrapper around PATCH /api/admin/content-assets, shared
// by every /admin/*-loops page's inline "Edit draft" UI (meme, quote,
// past-question, countdown, teaching, lesson). See that route's header for
// why `metadata` is a full replace, not a merge — callers here always pass
// the complete current metadata object with only the edited keys changed.
//
// Throws on failure so callers can show it in their existing errorMsg state
// the same way handleGenerate already does.
export async function updateContentAsset(id, { title, body, metadata, status } = {}) {
  const payload = { id };
  if (typeof title === 'string') payload.title = title;
  if (typeof body === 'string') payload.body = body;
  if (metadata && typeof metadata === 'object') payload.metadata = metadata;
  if (status) payload.status = status;

  const res = await fetch('/api/admin/content-assets', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data.contentAsset;
}
