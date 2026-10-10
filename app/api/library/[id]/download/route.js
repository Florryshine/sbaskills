import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@/lib/supabase-server';

function getBookStoragePath(rawUrl, supabaseUrl) {
  if (!rawUrl) return null;
  const value = String(rawUrl).trim();
  if (!/^https?:\/\//i.test(value)) {
    const path = value.replace(/^\/+/, '').replace(/^books\//, '');
    return path && !path.split('/').includes('..') ? path : null;
  }
  try {
    const url = new URL(value);
    const base = new URL(supabaseUrl);
    if (url.origin !== base.origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/books\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    return path && !path.split('/').includes('..') ? path : null;
  } catch { return null; }
}

export async function GET(_request, { params }) {
  try {
    const sessionClient = createRouteHandlerClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    const admin = createAdminClient();
    const { data: book, error: bookError } = await admin
      .from('books')
      .select('id, price, pdf_url, file_url, is_published, generation_status')
      .eq('id', params.id)
      .eq('is_published', true)
      .maybeSingle();

    if (bookError || !book || ['queued', 'processing'].includes(book.generation_status)) {
      return NextResponse.json({ error: 'Published book not found or not ready.' }, { status: 404 });
    }

    const price = Number(book.price || 0);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Invalid book price.' }, { status: 500 });
    }

    if (price > 0) {
      if (authError || !user) return NextResponse.json({ error: 'Please sign in to access this book.' }, { status: 401 });
      const { data: purchase, error: purchaseError } = await sessionClient
        .from('book_purchases').select('id')
        .eq('student_id', user.id).eq('book_id', book.id).eq('status', 'active').maybeSingle();
      if (purchaseError || !purchase) return NextResponse.json({ error: 'Purchase this book to download it.' }, { status: 403 });
    }

    const fileUrl = book.pdf_url || book.file_url;
    const storagePath = getBookStoragePath(fileUrl, process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (!storagePath) {
      if (price > 0) {
        return NextResponse.json({ error: 'This paid file must be stored in the protected books bucket before it can be downloaded.' }, { status: 503 });
      }
      if (fileUrl && /^https:\/\//i.test(String(fileUrl))) return NextResponse.redirect(String(fileUrl));
      return NextResponse.json({ error: 'The book file is not available yet.' }, { status: 404 });
    }

    const { data: signed, error: signError } = await admin.storage.from('books')
      .createSignedUrl(storagePath, 60, { download: true });
    if (signError || !signed?.signedUrl) {
      console.error('Book signed URL creation failed:', signError);
      return NextResponse.json({ error: 'Could not prepare the download. Please try again later.' }, { status: 500 });
    }
    return NextResponse.redirect(signed.signedUrl, 302);
  } catch (error) {
    console.error('Library download access error:', error);
    return NextResponse.json({ error: 'Unable to access this book right now.' }, { status: 500 });
  }
}
