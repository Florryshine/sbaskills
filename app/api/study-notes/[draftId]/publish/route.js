import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import StudyNoteDocument from '@/lib/pdf/StudyNoteDocument';
import { generatePdfFileName } from '@/lib/seo-utils';

export async function POST(request, { params }) {
  const { draftId } = params;

  // Optional style choice from the request body, e.g. { "themeKey": "modern" }.
  // See lib/pdf/themes.js for the full list (brand, modern, workbook,
  // premium, minimal, dark). Defaults to 'brand' if not provided or body is empty.
  let themeKey = 'brand';
  try {
    const body = await request.json();
    if (body?.themeKey) themeKey = body.themeKey;
  } catch {
    // no JSON body sent — fine, just use the default theme
  }

  try {
    // This route uses the service-role client to publish content, so the caller
    // must be an authenticated admin. Never trust the draft UUID as authorization.
    const sessionClient = createRouteHandlerClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in as an admin to publish study notes.' }, { status: 401 });
    }
    const { data: profile, error: profileError } = await sessionClient
      .from('profiles').select('role').eq('id', user.id).single();
    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access is required to publish study notes.' }, { status: 403 });
    }

    const supabase = createAdminClient();

    // 1. Fetch the draft
    const { data: draft, error: draftError } = await supabase
      .from('study_note_drafts')
      .select('*, knowledge_assets(keyword)')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Study note draft not found' }, { status: 404 });
    }

    const title = draft.title || draft.knowledge_assets?.keyword || 'Study Notes';
    const keyword = draft.knowledge_assets?.keyword || '';

    // Prevent repeat publish runs from creating another public book with the same title.
    // Existing draft-linked books are the intentional update path.
    if (!draft.book_id) {
      const { data: titleMatches, error: titleLookupError } = await supabase
        .from('books').select('id, title').ilike('title', title.trim());
      if (titleLookupError) {
        return NextResponse.json({ error: 'Could not check for an existing library title.' }, { status: 500 });
      }
      const existingTitle = (titleMatches || []).find((book) =>
        String(book.title || '').trim().toLowerCase() === title.trim().toLowerCase()
      );
      if (existingTitle) {
        return NextResponse.json({
          error: 'A library item with this title already exists. Review the existing item before publishing another copy.',
          existingBookId: existingTitle.id,
        }, { status: 409 });
      }
    }

    // 2. Render PDF with metadata and SEO-friendly file name
    let pdfBuffer;
    try {
      pdfBuffer = await renderToBuffer(
        React.createElement(StudyNoteDocument, {
          title,
          keyword,
          markdown: draft.content,
          authorType: 'team',
          themeKey
        })
      );
    } catch (renderError) {
      console.error('❌ PDF render error:', renderError);
      return NextResponse.json({ error: `PDF render failed: ${renderError.message}` }, { status: 500 });
    }

    // 3. Generate SEO-friendly file name and upload
    const fileName = generatePdfFileName(title);
    const filePath = `files/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('books')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('books').getPublicUrl(filePath);

    // 4. Insert or update library entry – using ONLY pdf_url
    let bookId = draft.book_id || null;

    if (bookId) {
      const { error: updateBookError } = await supabase
        .from('books')
        .update({
          title,
          description: draft.summary || `Exam-ready study notes on ${keyword}`,
          pdf_url: urlData.publicUrl,
          is_published: true,
        })
        .eq('id', bookId);
      if (updateBookError) {
        return NextResponse.json({ error: updateBookError.message }, { status: 500 });
      }
    } else {
      const { data: newBook, error: insertBookError } = await supabase
        .from('books')
        .insert({
          title,
          author: 'Shiney Brain Academy',
          description: draft.summary || `Exam-ready study notes on ${keyword}`,
          price: 0,
          pdf_url: urlData.publicUrl,
          is_published: true,
        })
        .select()
        .single();

      if (insertBookError) {
        return NextResponse.json({ error: insertBookError.message }, { status: 500 });
      }
      bookId = newBook.id;
    }

    // 5. Mark draft as published
    await supabase
      .from('study_note_drafts')
      .update({ status: 'published', book_id: bookId })
      .eq('id', draftId);

    return NextResponse.json({ success: true, bookId, fileUrl: urlData.publicUrl });
  } catch (error) {
    console.error('❌ Study note publish error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}