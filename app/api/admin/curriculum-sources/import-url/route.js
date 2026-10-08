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

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function extractHtmlText(html) {
  // Extract only readable page content, not scripts/styles or app metadata.
  const text = decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article|\/td|\/th)\b[^>]*>/gi, '\\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n\s*/g, '\\n')
    .replace(/\n{3,}/g, '\\n\\n')
    .trim();

  // A SPA shell with only "enable JavaScript" is not syllabus content.
  const normalized = text.toLowerCase();
  if (text.length < 300 || (normalized.includes('enable javascript') && text.length < 1200)) {
    return '';
  }
  return text;
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
        Accept: 'application/pdf, text/html;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.5',
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

    const signature = buffer.subarray(0, 5).toString('ascii');
    const isPdf = signature === '%PDF-';
    const looksLikeHtml = /text\/html|application\/xhtml\+xml/i.test(contentType)
      || /^\s*<(?:!doctype\s+html|html|head|body)\b/i.test(buffer.subarray(0, 1000).toString('utf8'));

    let extractedText = '';
    let sourceType = 'application/pdf';

    if (isPdf) {
      try {
        extractedText = await extractPdfText(buffer);
      } catch (error) {
        console.error('IBASS PDF parsing failed:', error);
        return NextResponse.json({ error: `IBASS returned a PDF, but text extraction failed: ${error?.message || 'Unknown parser error.'}` }, { status: 422 });
      }
    } else if (looksLikeHtml) {
      sourceType = 'text/html';
      extractedText = extractHtmlText(buffer.toString('utf8'));
      if (!extractedText) {
        return NextResponse.json({
          error: 'IBASS returned an HTML page, but it contains no readable syllabus text (likely the JavaScript app shell). The importer can extract syllabus text from HTML when it is present; this response requires finding the page data/API endpoint or using the file upload fallback.',
          source_type: sourceType,
          content_type: contentType || 'text/html',
          response_preview: buffer.subarray(0, 180).toString('utf8').replace(/\s+/g, ' ').slice(0, 160),
        }, { status: 422 });
      }
    } else {
      return NextResponse.json({
        error: `IBASS returned neither a PDF nor readable HTML. Content-type: ${contentType || 'unknown'}; signature: ${JSON.stringify(signature)}.`,
      }, { status: 422 });
    }

    if (!extractedText || extractedText.length < 100) {
      return NextResponse.json({ error: `The ${isPdf ? 'PDF' : 'HTML page'} did not contain enough extractable text to stage safely.` }, { status: 422 });
    }

    const subject = subjectFromUrl(url);
    const { data: existing } = await admin.from('curriculum_source_documents')
      .select('id').eq('curriculum_id', curriculumId).eq('source_url', url.toString()).maybeSingle();

    const payload = {
      curriculum_id: curriculumId,
      file_name: url.pathname.split('/').pop() || `${subject}.html`,
      file_type: sourceType,
      source_url: url.toString(),
      source_subject: subject,
      extracted_text: extractedText,
      extracted_chars: extractedText.length,
      status: 'parsed',
      notes: `Imported from official JAMB IBASS response (${sourceType}). Extracted text is staged only; not automatically published as curriculum nodes.`,
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
