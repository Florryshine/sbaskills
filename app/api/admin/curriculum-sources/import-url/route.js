import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 10;

const IBASS_HOST = 'ibass.jamb.gov.ng';
const MAX_BYTES = 15 * 1024 * 1024;

function validateIbassPdfUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== IBASS_HOST) {
    throw new Error('Only official JAMB IBASS PDF URLs are allowed.');
  }
  if (!/^\/assets\/uploads\/[^/]+\.pdf$/i.test(url.pathname)) {
    throw new Error('The URL must point to an IBASS syllabus PDF in /assets/uploads/.');
  }
  return url;
}

function subjectFromUrl(url) {
  return decodeURIComponent(url.pathname.split('/').pop() || '')
    .replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim();
}

async function extractPdfText(buffer) {
  // IMPORTANT: do not rely on pdf.worker.mjs existing as a separate file in
  // /var/task. pdf-parse provides getData() which embeds/provides the worker
  // through its package API and is the serverless-safe configuration.
  const { getData } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  PDFParse.setWorker(getData());

  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return String(parsed?.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

export async function POST(request) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const curriculumId = String(body.curriculum_id || '');
    const sourceUrl = String(body.source_url || '').trim();
    if (!curriculumId || !sourceUrl) {
      return NextResponse.json({ error: 'curriculum_id and source_url are required.' }, { status: 400 });
    }

    let url;
    try { url = validateIbassPdfUrl(sourceUrl); }
    catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }

    const admin = createAdminClient();
    const { data: curriculum } = await admin.from('curricula').select('id').eq('id', curriculumId).maybeSingle();
    if (!curriculum) return NextResponse.json({ error: 'Curriculum not found.' }, { status: 404 });

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/pdf',
        'User-Agent': 'Mozilla/5.0 (compatible; ShineyBrainAcademy/1.0)',
      },
      cache: 'no-store',
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());

    if (!response.ok) {
      return NextResponse.json({
        error: `IBASS returned HTTP ${response.status} (${contentType || 'unknown content type'}).`,
      }, { status: 502 });
    }

    if (!buffer.length || buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: 'IBASS response is empty or larger than 15MB.' }, { status: 400 });
    }

    // Reject the IBASS single-page app shell or any other non-PDF response
    // before passing bytes to pdf-parse. A valid PDF starts with "%PDF-".
    const signature = buffer.subarray(0, 5).toString('ascii');
    if (signature !== '%PDF-') {
      const preview = buffer.subarray(0, 240).toString('utf8')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim()
        .slice(0, 160);

      return NextResponse.json({
        error: `IBASS did not return a PDF. HTTP ${response.status}; content-type: ${contentType || 'unknown'}; signature: ${JSON.stringify(signature)}.${preview ? ` Response preview: ${preview}` : ''}`,
      }, { status: 422 });
    }

    let extractedText = '';
    try {
      extractedText = await extractPdfText(buffer);
    } catch (error) {
      console.error('IBASS PDF parsing failed:', error);
      return NextResponse.json({ error: `PDF parsing failed: ${error?.message || 'Unknown parser error.'}` }, { status: 422 });
    }

    if (!extractedText) {
      return NextResponse.json({ error: 'The PDF contained no extractable text.' }, { status: 422 });
    }

    const subject = subjectFromUrl(url);
    const { data: existing } = await admin.from('curriculum_source_documents')
      .select('id').eq('curriculum_id', curriculumId).eq('source_url', url.toString()).maybeSingle();

    const payload = {
      curriculum_id: curriculumId,
      file_name: url.pathname.split('/').pop(),
      file_type: 'application/pdf',
      source_url: url.toString(),
      source_subject: subject,
      extracted_text: extractedText,
      extracted_chars: extractedText.length,
      status: 'parsed',
      notes: 'Imported directly from official JAMB IBASS. Staged only; not automatically published as curriculum nodes.',
      uploaded_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const result = existing?.id
      ? await admin.from('curriculum_source_documents').update(payload).eq('id', existing.id).select().single()
      : await admin.from('curriculum_source_documents').insert(payload).select().single();

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      document: {
        id: result.data.id,
        subject,
        source_url: url.toString(),
        extracted_chars: extractedText.length,
        status: result.data.status,
      },
    });
  } catch (error) {
    console.error('Curriculum source API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error.' }, { status: 500 });
  }
}
