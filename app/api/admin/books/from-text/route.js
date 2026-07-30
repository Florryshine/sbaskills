import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import BookDocument from '@/lib/pdf/BookDocument';
import { parseMarkdownToBlocks } from '@/lib/pdf/parseMarkdown';
import { enrichYoutubeBlocks } from '@/lib/pdf/youtube';
import { generatePdfFileName } from '@/lib/seo-utils';

// Vercel's default serverless timeout is too short for rendering long
// pasted books with @react-pdf/renderer + uploading the buffer to
// Supabase storage. 60s is the max allowed on the Hobby plan.
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

    // 1. Parse pasted markdown into blocks, then enrich any bare
    // YouTube links into video cards (title/channel/thumbnail) before
    // rendering — @react-pdf/renderer builds its tree synchronously,
    // so all async work has to happen up front.
    const rawBlocks = parseMarkdownToBlocks(markdown);
    const blocks = await enrichYoutubeBlocks(rawBlocks);

    // 2. Render the branded PDF
    let pdfBuffer;
    try {
      pdfBuffer = await renderToBuffer(
        React.createElement(BookDocument, {
          title,
          subtitle: description,
          blocks,
          themeKey,
          authorType,
        })
      );
    } catch (renderError) {
      console.error('❌ Book PDF render error:', renderError);
      return NextResponse.json({ error: `PDF render failed: ${renderError.message}` }, { status: 500 });
    }

    // 3. Upload to the same storage bucket the existing study-notes
    // pipeline already uses
    const fileName = generatePdfFileName(title);
    const filePath = `files/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('books')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('books').getPublicUrl(filePath);

    // 4. Insert or update the book row
    const bookPayload = {
      title,
      author,
      description,
      price: parseInt(price, 10) || 0,
      pdf_url: urlData.publicUrl,
      is_published: true,
      source_markdown: markdown,
      template: themeKey,
    };
    // Only set cover_url when a new cover was actually uploaded this
    // time, so regenerating an existing book without re-picking a cover
    // doesn't wipe out the one it already has.
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
        .insert(bookPayload)
        .select()
        .single();
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      resultId = newBook.id;
    }

    return NextResponse.json({ success: true, bookId: resultId, fileUrl: urlData.publicUrl });
  } catch (error) {
    console.error('❌ Book from-text generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
