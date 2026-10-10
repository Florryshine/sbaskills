import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

// The book metadata API must not expose paid file URLs. This route checks
// ownership before redirecting to the stored file location.
export async function GET(_request, { params }) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, price, pdf_url, file_url, is_published, generation_status')
      .eq('id', params.id)
      .eq('is_published', true)
      .maybeSingle();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Published book not found.' }, { status: 404 });
    }

    if (Number(book.price) > 0) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Please sign in to access this book.' }, { status: 401 });
      }

      const { data: purchase, error: purchaseError } = await supabase
        .from('book_purchases')
        .select('id')
        .eq('student_id', user.id)
        .eq('book_id', book.id)
        .eq('status', 'active')
        .maybeSingle();

      if (purchaseError || !purchase) {
        return NextResponse.json({ error: 'Purchase this book to download it.' }, { status: 403 });
      }
    }

    const fileUrl = book.pdf_url || book.file_url;
    if (!fileUrl) {
      return NextResponse.json({ error: 'This book does not have a downloadable file yet.' }, { status: 404 });
    }

    let destination;
    try { destination = new URL(fileUrl); } catch {
      return NextResponse.json({ error: 'The book file URL is invalid.' }, { status: 500 });
    }
    if (destination.protocol !== 'https:') {
      return NextResponse.json({ error: 'The book file URL is not secure.' }, { status: 500 });
    }

    return NextResponse.redirect(destination.toString(), 302);
  } catch (error) {
    console.error('Library download access error:', error);
    return NextResponse.json({ error: 'Unable to access this book right now.' }, { status: 500 });
  }
}