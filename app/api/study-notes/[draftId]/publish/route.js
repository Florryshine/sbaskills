// app/api/study-notes/[draftId]/publish/route.js
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import StudyNoteDocument from '@/lib/pdf/StudyNoteDocument';

export async function POST(request, { params }) {
  const { draftId } = params;

  try {
    const supabase = createAdminClient();

    // 1. Fetch the draft (this is the AI's markdown, possibly already hand-edited by you)
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

    // 2. Render the PDF using the shared branded template
    const pdfBuffer = await renderToBuffer(
      React.createElement(StudyNoteDocument, { title, keyword, markdown: draft.content })
    );

    // 3. Upload to the SAME 'books' bucket your manual library uploads already use
    const fileName = `study-notes-${draftId}-${Date.now()}.pdf`;
    const filePath = `files/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('books')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('books').getPublicUrl(filePath);

    // 4. Insert or update the library entry (avoid duplicates on re-publish)
    let bookId = draft.book_id || null;

    if (bookId) {
      const { error: updateBookError } = await supabase
        .from('books')
        .update({
          title,
          description: draft.summary || `Exam-ready study notes on ${keyword}`,
          file_url: urlData.publicUrl,
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
          file_url: urlData.publicUrl,
          is_published: true,
        })
        .select()
        .single();

      if (insertBookError) {
        return NextResponse.json({ error: insertBookError.message }, { status: 500 });
      }
      bookId = newBook.id;
    }

    // 5. Mark the draft as published and remember which book it maps to
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