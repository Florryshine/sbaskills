import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

function getStoragePath(rawUrl, supabaseUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(String(rawUrl));
    const base = new URL(supabaseUrl);
    if (url.origin !== base.origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/books\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    return path && !path.split('/').includes('..') ? path : null;
  } catch { return null; }
}

// Book covers are public-facing assets, but live in the same bucket as PDFs.
// Sign the cover URL server-side so the bucket itself can remain private.
export async function GET(_request, { params }) {
  try {
    const admin = createAdminClient();
    const { data: book, error } = await admin
      .from('books').select('cover_url, is_published').eq('id', params.id).eq('is_published', true).maybeSingle();
    if (error || !book?.cover_url) return NextResponse.json({ error: 'Cover not found.' }, { status: 404 });

    const storagePath = getStoragePath(book.cover_url, process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (!storagePath) {
      if (/^https:\/\//i.test(String(book.cover_url))) return NextResponse.redirect(String(book.cover_url));
      return NextResponse.json({ error: 'Cover URL is invalid.' }, { status: 404 });
    }

    const { data, error: signError } = await admin.storage.from('books').createSignedUrl(storagePath, 300);
    if (signError || !data?.signedUrl) return NextResponse.json({ error: 'Cover unavailable.' }, { status: 500 });
    return NextResponse.redirect(data.signedUrl, 302);
  } catch (error) {
    console.error('Library cover error:', error);
    return NextResponse.json({ error: 'Cover unavailable.' }, { status: 500 });
  }
}
