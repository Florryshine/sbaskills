import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { processBookGeneration } from '@/lib/pdf/processBookGeneration';
import { runInBackground } from '@/lib/backgroundTask';

// This route now only does the fast, cheap part synchronously:
// validate input, upsert the book row as "queued", and kick off the
// actual parse/render/upload as a background task via runInBackground
// (see lib/backgroundTask.js). The response comes back almost
// instantly with a bookId, so the browser's fetch() never has a
// chance to sit and wait 60-800s for a 30k-50k word PDF to render --
// which is what was producing the 504s at 35k-45k words.
//
// maxDuration still matters here: on Vercel, runInBackground uses
// waitUntil() to keep this function alive *after* the response is
// sent so the background render actually gets to finish, and that
// extension is capped by maxDuration. Set this to your plan's real
// ceiling (Hobby is stuck at 60 regardless; Pro allows 300; Pro with
// Fluid Compute allows up to 800). This project is on Hobby, so 60 is
// the real ceiling here -- an earlier 800 exceeded it and was failing
// every deploy since the commit that introduced it ("Builder returned
// invalid maxDuration value ... must have a maxDuration between 1 and
// 300 for plan hobby"). If you upgrade plans, raise this to match, and
// note a 30k-50k word book may still not fully render within 60s even
// on the background path -- worth testing after any plan change.
export const maxDuration = 60;

export async function POST(request) {
  try {
    const {
      title,
      description = '',
      author = 'Shiney Brain Academy',
      price = 0,
      markdown,
      themeKey = 'brand',
      authorType = 'team',
      coverUrl = null,
      bookId = null, // pass an existing book id to regenerate/update it
    } = await request.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!markdown || !markdown.trim()) {
      return NextResponse.json({ error: 'Markdown content is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Create/update the book row up front, marked "queued", so the
    // frontend has a bookId to poll immediately. pdf_url is left as-is
    // on a regenerate (so the old PDF keeps working while the new one
    // renders) and null on a fresh book.
    const bookPayload = {
      title,
      author,
      description,
      price: parseInt(price, 10) || 0,
      is_published: true,
      source_markdown: markdown,
      template: themeKey,
      generation_status: 'queued',
      generation_error: null,
    };
    if (coverUrl) {
      bookPayload.cover_url = coverUrl;
    }

    let resultId = bookId;

    if (bookId) {
      const { error: updateError } = await supabase.from('books').update(bookPayload).eq('id', bookId);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    } else {
      const { data: newBook, error: insertError } = await supabase
        .from('books')
        .insert({ ...bookPayload, pdf_url: null })
        .select()
        .single();
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      resultId = newBook.id;
    }

    // 2. Fire off the actual generation without waiting for it. The
    // client finds out it's done by polling
    // GET /api/admin/books/[bookId]/status.
    runInBackground(() =>
      processBookGeneration(resultId, {
        title,
        description,
        markdown,
        themeKey,
        authorType,
        coverUrl,
      })
    );

    return NextResponse.json({ success: true, bookId: resultId, status: 'queued' });
  } catch (error) {
    console.error('❌ Book from-text generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
