import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;
const MIME_EXT = new Map([['audio/mpeg','mp3'],['audio/wav','wav'],['audio/x-wav','wav'],['audio/mp4','m4a'],['audio/ogg','ogg']]);

export async function POST(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Choose an audio file.' }, { status: 400 });
    const mime = String(file.type || '').toLowerCase();
    const extension = MIME_EXT.get(mime);
    if (!extension) return NextResponse.json({ error: 'Supported formats: MP3, WAV, M4A and OGG.' }, { status: 400 });
    if (file.size < 512 || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Music file must be between 512 bytes and 20 MB.' }, { status: 400 });
    const supabase = createAdminClient();
    const storagePath = 'music/' + randomUUID() + '.' + extension;
    const { error } = await supabase.storage.from('tegaki-assets').upload(storagePath, Buffer.from(await file.arrayBuffer()), { contentType: mime, upsert: false });
    if (error) throw error;
    const url = supabase.storage.from('tegaki-assets').getPublicUrl(storagePath).data.publicUrl;
    return NextResponse.json({ success: true, music: { url, name: String(file.name || 'background music').slice(0, 120), storagePath } });
  } catch (error) {
    console.error('Tegaki music upload failed:', error);
    return NextResponse.json({ error: error.message || 'Could not upload background music.' }, { status: 400 });
  }
}
