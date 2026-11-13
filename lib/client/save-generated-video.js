import { createBrowserClient } from '@/lib/supabase';

export async function saveGeneratedVideo({ blob, title, caption, topic, source, metadata = {}, durationSeconds }) {
  if (!(blob instanceof Blob) || !blob.size) throw new Error('The rendered video is empty.');
  const mimeType = (blob.type || 'video/webm').split(';')[0].toLowerCase();
  const prepareResponse = await fetch('/api/admin/creator-videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'prepare', title, caption, topic, source, mimeType, metadata }),
  });
  const prepared = await prepareResponse.json();
  if (!prepareResponse.ok) throw new Error(prepared.error || 'Could not prepare the Social Engine draft.');

  const supabase = createBrowserClient();
  const { error: uploadError } = await supabase.storage
    .from(prepared.bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: mimeType, upsert: false });
  if (uploadError) throw new Error(uploadError.message || 'Video upload failed.');

  const completeResponse = await fetch('/api/admin/creator-videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      contentAssetId: prepared.contentAssetId,
      path: prepared.path,
      title,
      caption,
      mimeType,
      fileSizeBytes: blob.size,
      durationSeconds,
      metadata,
    }),
  });
  const completed = await completeResponse.json();
  if (!completeResponse.ok) throw new Error(completed.error || 'Video uploaded but could not be attached to the Social Engine.');
  return completed;
}
