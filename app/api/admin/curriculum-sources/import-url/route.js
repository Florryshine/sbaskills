import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

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
  const name = decodeURIComponent(url.pathname.split('/').pop() || '').replace(/\.pdf$/i, '');
  return name.replace(/[-_]+/g, ' ').trim();
}

export async function POST(request) {
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
  try {
    url = validateIbassPdfUrl(sourceUrl);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: curriculum } = await admin.from('curricula').select('id, name, code').eq('id', curriculumId).maybeSingle();
  if (!curriculum) return NextResponse.json({ error: 'Curriculum not found.' }, { status: 404 });

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/pdf' },
    cache: 'no-store',
  });

  if (!response.ok) {
    return NextResponse.json({ error: `IBASS returned HTTP ${response.status}.` }, { status: 502 });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: 'IBASS PDF is empty or larger than 15MB.' }, { status: 400 });
  }

  let extractedText = '';
  try {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    extractedText = String(parsed?.text || '').trim();
    await parser.destroy();
  } catch (error) {
    return NextResponse.json({ error: `PDF parsing failed: ${error.message}` }, { status: 422 });
  }

  if (!extractedText) {
    return NextResponse.json({ error: 'The PDF contained no extractable text.' }, { status: 422 });
  }

  const subject = subjectFromUrl(url);

  const { data: existing } = await admin.from('curriculum_source_documents')
    .select('id')
    .eq('curriculum_id', curriculumId)
    .eq('source_url', url.toString())
    .maybeSingle();

  const payload = {
    curriculum_id: curriculumId,
    file_name: url.pathname.split('/').pop(),
    file_type: 'application/pdf',
    source_url: url.toString(),
    source_subject: subject,
    extracted_text: extractedText,
    extracted_chars: extractedText.length,
    status: 'parsed',
    notes: 'Imported directly from official JAMB IBASS. Content is staged and not published as curriculum nodes automatically.',
    uploaded_by: user.id,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing?.id) {
    result = await admin.from('curriculum_source_documents').update(payload).eq('id', existing.id).select().single();
  } else {
    result = await admin.from('curriculum_source_documents').insert(payload).select().single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

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
}
