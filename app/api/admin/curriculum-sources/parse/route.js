import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function extractPdfText(buffer) {
  const { getData } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  PDFParse.setWorker(getData());
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return String(result?.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

export async function POST(request) {
  try {
    const auth = createServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await auth.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { document_id } = await request.json();
    if (!document_id) return NextResponse.json({ error: 'document_id is required.' }, { status: 400 });

    const admin = createAdminClient();
    const { data: doc, error: docError } = await admin.from('curriculum_source_documents')
      .select('id,curriculum_id,file_name,file_type,storage_path,status')
      .eq('id', document_id).maybeSingle();
    if (docError) throw docError;
    if (!doc) return NextResponse.json({ error: 'Source document not found.' }, { status: 404 });
    if (!doc.storage_path) return NextResponse.json({ error: 'This source has no stored file path to parse.' }, { status: 422 });

    const { data: file, error: downloadError } = await admin.storage.from('curriculum-sources').download(doc.storage_path);
    if (downloadError) throw downloadError;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length || buffer.length > 15 * 1024 * 1024) return NextResponse.json({ error: 'File is empty or exceeds 15MB.' }, { status: 400 });

    let extractedText = '';
    const type = String(doc.file_type || '').toLowerCase();
    const name = String(doc.file_name || '').toLowerCase();
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      extractedText = await extractPdfText(buffer);
    } else if (type.includes('text/') || name.endsWith('.txt') || name.endsWith('.csv')) {
      extractedText = buffer.toString('utf8').trim();
    } else if (name.endsWith('.docx') || type.includes('wordprocessingml')) {
      const mammoth = await import('mammoth');
      const parsed = await mammoth.extractRawText({ buffer });
      extractedText = String(parsed.value || '').trim();
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || type.includes('spreadsheet') || type.includes('excel')) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      extractedText = workbook.SheetNames.map(sheet => XLSX.utils.sheet_to_csv(workbook.Sheets[sheet])).join('\n\n').trim();
    } else {
      return NextResponse.json({ error: 'This file format is stored but automatic text extraction is not supported yet. Use PDF, TXT, CSV, DOCX or Excel.' }, { status: 415 });
    }

    if (extractedText.length < 50) {
      return NextResponse.json({ error: 'The file was opened, but too little readable text was extracted. If it is a scanned/image-only PDF, OCR is required.' }, { status: 422 });
    }

    const subject = String(doc.file_name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/syllabus/ig, '').replace(/academicng\.com/ig, '').trim();
    const { data: updated, error: updateError } = await admin.from('curriculum_source_documents').update({
      extracted_text: extractedText,
      extracted_chars: extractedText.length,
      source_subject: subject || null,
      status: 'parsed',
      notes: 'File text extracted and staged. Review before publishing syllabus topics.',
      updated_at: new Date().toISOString(),
    }).eq('id', document_id).select('id,file_name,status,extracted_chars,source_subject').single();
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('Curriculum source parse error:', error);
    return NextResponse.json({ error: error?.message || 'Could not parse source file.' }, { status: 500 });
  }
}
