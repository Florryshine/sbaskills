import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// Polled by app/admin/books/from-text/page.js after POSTing to
// /api/admin/books/from-text, which now returns almost immediately
// with { bookId, status: 'queued' } instead of waiting for the PDF.
export async function GET(_request, { params }) {
  const { bookId } = params;

  if (!bookId) {
    return NextResponse.json({ error: 'bookId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('books')
    .select('id, title, pdf_url, generation_status, generation_error')
    .eq('id', bookId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({
    bookId: data.id,
    title: data.title,
    status: data.generation_status,
    fileUrl: data.pdf_url,
    error: data.generation_error,
  });
}
