// lib/pdf/processBookGeneration.js
//
// The actual "paste text -> branded PDF" work, extracted out of the
// route handler so it can run in the background (via
// lib/backgroundTask.js) instead of inside the request/response cycle.
// This is the same logic that used to live directly in
// app/api/admin/books/from-text/route.js — nothing about how the PDF
// is built has changed, only *when* it runs relative to the response.
import { createAdminClient } from '@/lib/supabase-admin';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import BookDocument from '@/lib/pdf/BookDocument';
import { parseMarkdownToBlocks } from '@/lib/pdf/parseMarkdown';
import { enrichYoutubeBlocks } from '@/lib/pdf/youtube';
import { generatePdfFileName } from '@/lib/seo-utils';

export async function processBookGeneration(bookId, params) {
  const {
    title,
    description = '',
    markdown,
    themeKey = 'brand',
    authorType = 'team',
    coverUrl = null,
  } = params;

  const supabase = createAdminClient();

  try {
    await supabase
      .from('books')
      .update({ generation_status: 'processing', generation_error: null })
      .eq('id', bookId);

    // 1. Parse pasted markdown into blocks, then enrich any bare
    // YouTube links into video cards (title/channel/thumbnail) before
    // rendering — @react-pdf/renderer builds its tree synchronously,
    // so all async work has to happen up front.
    const rawBlocks = parseMarkdownToBlocks(markdown);
    const blocks = await enrichYoutubeBlocks(rawBlocks);

    // 2. Render the branded PDF. This is the slow part for long
    // (30k-50k+ word) books — now that it runs after the response has
    // already been sent, it's free to take minutes without the
    // browser's request timing out or a platform gateway 504'ing it.
    const pdfBuffer = await renderToBuffer(
      React.createElement(BookDocument, {
        title,
        subtitle: description,
        blocks,
        themeKey,
        authorType,
      })
    );

    // 3. Upload to the same storage bucket the existing study-notes
    // pipeline already uses
    const fileName = generatePdfFileName(title);
    const filePath = `files/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('books')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from('books').getPublicUrl(filePath);

    // 4. Mark the row ready. Only set cover_url when a new cover was
    // actually uploaded this time, so regenerating an existing book
    // without re-picking a cover doesn't wipe out the one it already
    // has.
    const updatePayload = {
      pdf_url: urlData.publicUrl,
      generation_status: 'ready',
      generation_error: null,
    };
    if (coverUrl) {
      updatePayload.cover_url = coverUrl;
    }

    const { error: updateError } = await supabase.from('books').update(updatePayload).eq('id', bookId);
    if (updateError) throw new Error(updateError.message);

    return { success: true, bookId, fileUrl: urlData.publicUrl };
  } catch (error) {
    console.error('❌ Book from-text generation error:', error);
    await supabase
      .from('books')
      .update({ generation_status: 'failed', generation_error: error.message || 'Unknown error' })
      .eq('id', bookId);
    throw error;
  }
}
