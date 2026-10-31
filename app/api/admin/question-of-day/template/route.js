import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
export const runtime = 'nodejs';
const BUCKET = 'sba-question-of-day';

export async function GET() {
  try {
    const { data, error } = await createAdminClient().storage.from(BUCKET).list('templates');
    if (error) throw error;
    return NextResponse.json({ uploaded: (data || []).some((f) => f.name === 'classroom-template.jpg') });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('template');
    if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Choose the classroom template image.' }, { status: 400 });
    if (!file.type || !file.type.startsWith('image/')) return NextResponse.json({ error: 'Template must be an image.' }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'Image must be smaller than 12 MB.' }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await createAdminClient().storage.from(BUCKET).upload('templates/classroom-template.jpg', bytes, { contentType: file.type, upsert: true });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error.message || 'Template upload failed.' }, { status: 500 }); }
}
