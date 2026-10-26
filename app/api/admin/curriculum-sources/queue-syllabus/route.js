import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (value, max = 600) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const subjects = [
  ['Biology', /bio(logy)?/i], ['Chemistry', /chem(istry)?/i], ['Physics', /phys(ics)?/i],
  ['Mathematics', /math(ematic(s)?)?/i], ['Use of English', /english/i], ['CRS', /christian religious|\bcrs\b/i],
  ['IRS', /islamic religious|\birs\b/i], ['Government', /government/i], ['Literature in English', /literature/i],
  ['Economics', /economics?/i], ['Commerce', /commerce/i], ['Accounting', /accounting|principles of accounts/i],
  ['Agricultural Science', /agricultural|agriculture/i], ['Geography', /geography/i], ['Computer Studies', /computer/i],
  ['French', /french/i], ['Arabic', /arabic/i], ['Hausa', /hausa/i], ['Igbo', /igbo/i], ['Yoruba', /yoruba/i],
];
const subjectName = value => {
  const v = String(value || '').replace(/\.[^.]+$/, '').replace(/jamb|utme|syllabus|202[6-9]/ig, '').replace(/[_-]+/g, ' ').trim();
  return subjects.find(([name, regex]) => regex.test(v))?.[0] || null;
};
const parseJson = value => JSON.parse(String(value || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim());
const chunksOf = value => {
  const chunks = [];
  let rest = String(value || '').trim();
  while (rest.length > 6000) {
    let splitAt = rest.lastIndexOf('\n', 6000);
    if (splitAt < 3000) splitAt = 6000;
    chunks.push(rest.slice(0, splitAt));
    rest = rest.slice(splitAt).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
};

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
    const { data: doc, error } = await admin.from('curriculum_source_documents')
      .select('id,curriculum_id,file_name,source_subject,extracted_text,status')
      .eq('id', document_id).maybeSingle();
    if (error) throw error;
    if (!doc) return NextResponse.json({ error: 'Source document not found.' }, { status: 404 });
    if (!doc.extracted_text || doc.extracted_text.trim().length < 50) {
      return NextResponse.json({ error: 'Extract text successfully before building the syllabus.' }, { status: 422 });
    }

    const subject = subjectName(doc.source_subject) || subjectName(doc.file_name);
    if (!subject) return NextResponse.json({ error: 'Could not identify a supported JAMB subject from the source filename/subject.' }, { status: 422 });

    const chunks = chunksOf(doc.extracted_text);
    if (!chunks.length) return NextResponse.json({ error: 'No readable syllabus chunks were found.' }, { status: 422 });

    const { data: activeJob, error: activeError } = await admin.from('curriculum_processing_jobs')
      .select('id,status').eq('document_id', document_id)
      .in('status', ['queued', 'processing', 'partially_completed']).maybeSingle();
    if (activeError) throw activeError;
    if (activeJob) {
      return NextResponse.json({ success: true, queued: false, job_id: activeJob.id, status: activeJob.status, message: 'This source already has an active processing job.' });
    }

    const { data: job, error: jobError } = await admin.from('curriculum_processing_jobs').insert({
      document_id,
      curriculum_id: doc.curriculum_id,
      subject,
      status: 'queued',
      chunks,
      total_chunks: chunks.length,
      next_chunk_index: 0,
      attempts: {},
      stats: { topics_added: 0, topics_already_existing: 0, objectives_added: 0, assets_created: 0, assets_linked: 0 },
    }).select('id,status,total_chunks').single();
    if (jobError) throw jobError;

    const { error: updateError } = await admin.from('curriculum_source_documents').update({
      status: 'processing',
      source_subject: subject,
      notes: `Queued for background syllabus building (0/${chunks.length} chunks processed).`,
      updated_at: new Date().toISOString(),
    }).eq('id', document_id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, queued: true, job_id: job.id, status: job.status, total_chunks: job.total_chunks });
  } catch (error) {
    console.error('Queue syllabus job failed:', error);
    return NextResponse.json({ error: error?.message || 'Could not queue syllabus processing.' }, { status: 500 });
  }
}
