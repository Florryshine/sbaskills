import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@/lib/supabase-server';

function getStoragePath(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(String(rawUrl));
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (url.origin !== base.origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/books\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

// Polling endpoint for the admin book generator. It exposes status only to admins
// and returns a short-lived signed preview URL rather than a raw public PDF URL.
export async function GET(_request, { params }) {
  const { bookId } = params;
  if (!bookId) return NextResponse.json({ error: 'bookId is required' }, { status: 400 });

  const sessionClient = createRouteHandlerClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Sign in as an admin.' }, { status: 401 });
  const { data: profile } = await sessionClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('books')
    .select('id, title, pdf_url, generation_status, generation_error')
    .eq('id', bookId).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Book not found.' }, { status: 404 });

  let fileUrl = null;
  if (data.pdf_url) {
    const path = getStoragePath(data.pdf_url);
    if (path) {
      const { data: signed, error: signError } = await admin.storage.from('books').createSignedUrl(path, 3600, { download: true });
      if (signError) return NextResponse.json({ error: 'Could not create PDF preview link.' }, { status: 500 });
      fileUrl = signed?.signedUrl || null;
    } else if (/^https:\/\//i.test(String(data.pdf_url))) {
      fileUrl = data.pdf_url;
    }
  }

  return NextResponse.json({ bookId: data.id, title: data.title, status: data.generation_status, fileUrl, error: data.generation_error });
}
