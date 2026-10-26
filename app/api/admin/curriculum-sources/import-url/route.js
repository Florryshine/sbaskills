import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const IBASS_HOST = 'ibass.jamb.gov.ng';
const MAX_BYTES = 15 * 1024 * 1024;

function validateIbassPdfUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== IBASS_HOST) throw new Error('Only official JAMB IBASS PDF URLs are allowed.');
  if (!/^\/assets\/uploads\/[^/]+\.pdf$/i.test(url.pathname)) throw new Error('The URL must point to an IBASS syllabus PDF in /assets/uploads/.');
  return url;
}
function subjectFromUrl(url) {
  return decodeURIComponent(url.pathname.split('/').pop() || '').replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim();
}
function safeFilePart(value) {
  return String(value || 'subject').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'subject';
}

export async function POST(request) {
  try {
    const auth = createServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await auth.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const curriculumId = String(body.curriculum_id || '');
    const sourceUrl = String(body.source_url || '').trim();
    if (!curriculumId || !sourceUrl) return NextResponse.json({ error: 'curriculum_id and source_url are required.' }, { status: 400 });

    let url;
    try { url = validateIbassPdfUrl(sourceUrl); }
    catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }

    const admin = createAdminClient();
    const { data: curriculum, error: curriculumError } = await admin.from('curricula').select('id').eq('id', curriculumId).maybeSingle();
    if (curriculumError) throw curriculumError;
    if (!curriculum) return NextResponse.json({ error: 'Curriculum not found.' }, { status: 404 });

    const subject = subjectFromUrl(url);
    const { data: existing, error: existingError } = await admin.from('curriculum_source_documents')
      .select('id').eq('curriculum_id', curriculumId).eq('source_url', url.toString()).maybeSingle();
    if (existingError) throw existingError;

    if (existing?.id) {
      const { data: activeJob, error: activeError } = await admin.from('curriculum_processing_jobs')
        .select('id,status').eq('document_id', existing.id)
        .in('status', ['queued', 'processing', 'partially_completed']).maybeSingle();
      if (activeError) throw activeError;
      if (activeJob) {
        const secret = process.env.CURRICULUM_WORKER_SECRET;
        if (secret) waitUntil(fetch(new URL('/api/internal/curriculum-worker', request.url), { method: 'POST', headers: { authorization: `Bearer ${secret}` } }).catch(error => console.error('Could not resume IBASS curriculum worker:', error)));
        return NextResponse.json({ success: true, queued: false, job_id: activeJob.id, document: { id: existing.id, subject, source_url: url.toString(), extracted_chars: 0, status: activeJob.status }, message: 'This IBASS source already has an active processing job; it has been resumed.' });
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/pdf, */*;q=0.5',
        'User-Agent': 'Mozilla/5.0 (compatible; ShineyBrainAcademy/1.0)',
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(45000),
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) return NextResponse.json({ error: `IBASS returned HTTP ${response.status} (${contentType || 'unknown content type'}).` }, { status: 502 });

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_BYTES) return NextResponse.json({ error: 'IBASS response is empty or larger than 15MB.' }, { status: 400 });
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      const preview = buffer.subarray(0, 180).toString('utf8').replace(/\s+/g, ' ').slice(0, 160);
      return NextResponse.json({
        error: 'IBASS did not return a PDF file. Download the official PDF in your browser and upload it here.',
        source_type: contentType || 'unknown',
        response_preview: preview,
      }, { status: 422 });
    }

    const storagePath = `${curriculumId}/ibass-${safeFilePart(subject)}-${Date.now()}.pdf`;
    const { error: uploadError } = await admin.storage.from('curriculum-sources').upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const payload = {
      curriculum_id: curriculumId,
      file_name: url.pathname.split('/').pop() || `${subject}.pdf`,
      file_type: 'application/pdf',
      source_url: url.toString(),
      source_subject: subject,
      storage_path: storagePath,
      extracted_text: null,
      extracted_chars: 0,
      status: 'uploaded',
      notes: 'Official IBASS PDF downloaded and stored. Background extraction and syllabus/Knowledge Asset processing is queued.',
      uploaded_by: user.id,
      updated_at: new Date().toISOString(),
    };
    const saved = existing?.id
      ? await admin.from('curriculum_source_documents').update(payload).eq('id', existing.id).select('id').single()
      : await admin.from('curriculum_source_documents').insert(payload).select('id').single();
    if (saved.error) {
      await admin.storage.from('curriculum-sources').remove([storagePath]);
      throw saved.error;
    }

    const { data: job, error: jobError } = await admin.from('curriculum_processing_jobs').insert({
      document_id: saved.data.id,
      curriculum_id: curriculumId,
      subject,
      status: 'queued',
      chunks: [],
      total_chunks: 1,
      next_chunk_index: 0,
      attempts: {},
      stats: { topics_added: 0, topics_already_existing: 0, objectives_added: 0, assets_created: 0, assets_linked: 0 },
    }).select('id,status,total_chunks').single();
    if (jobError) throw jobError;

    const secret = process.env.CURRICULUM_WORKER_SECRET;
    if (secret) waitUntil(fetch(new URL('/api/internal/curriculum-worker', request.url), { method: 'POST', headers: { authorization: `Bearer ${secret}` } }).catch(error => console.error('Could not start IBASS curriculum worker:', error)));

    return NextResponse.json({
      success: true,
      queued: true,
      job_id: job.id,
      document: { id: saved.data.id, subject, source_url: url.toString(), extracted_chars: 0, status: 'processing' },
      message: 'IBASS PDF stored successfully. Text extraction and syllabus/Knowledge Asset creation are running in the background.',
    });
  } catch (error) {
    console.error('Curriculum IBASS import error:', error);
    return NextResponse.json({ error: error?.message || 'IBASS import failed.' }, { status: 500 });
  }
}
