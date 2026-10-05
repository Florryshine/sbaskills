import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

const BUCKET = 'curriculum-sources';
const ALLOWED = new Set(['text/plain','text/csv','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword']);

export async function POST(request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const form = await request.formData();
  const file = form.get('file');
  const curriculumId = form.get('curriculum_id');
  const notes = String(form.get('notes') || '');

  if (!(file instanceof File) || !curriculumId) return NextResponse.json({ error: 'File and curriculum are required.' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Supported files: TXT, CSV, Excel, Word and PDF.' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Maximum file size is 15MB.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: bucket } = await admin.storage.getBucket(BUCKET);
  if (!bucket) {
    const { error: bucketError } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '15MB' });
    if (bucketError && !String(bucketError.message).toLowerCase().includes('already exists')) {
      return NextResponse.json({ error: bucketError.message }, { status: 500 });
    }
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const storagePath = `${curriculumId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await admin.from('curriculum_source_documents').insert({
    curriculum_id: curriculumId,
    file_name: file.name,
    file_type: file.type || 'application/octet-stream',
    storage_path: storagePath,
    status: 'uploaded',
    notes,
    uploaded_by: user.id,
  }).select().single();

  if (error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, document: data });
}
