import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/parent-links?school=<slug>&student_id=... or &parent_id=...
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  const studentId = searchParams.get('student_id');
  const parentId = searchParams.get('parent_id');
  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  let query = supabase
    .from('parent_links')
    .select('id, parent_id, student_id, created_at, parent:parent_id(full_name, email), student:student_id(full_name, email, student_level)')
    .eq('school_id', school.id);

  if (studentId) query = query.eq('student_id', studentId);
  if (parentId) query = query.eq('parent_id', parentId);

  const { data, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ links: data || [] });
}

// POST /api/school/parent-links
// Body: { school, parent_id, student_id }
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, parent_id, student_id } = body;
  if (!schoolSlug || !parent_id || !student_id) {
    return NextResponse.json({ error: 'Missing school, parent_id, or student_id.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: insertError } = await supabase
    .from('parent_links')
    .upsert({ school_id: school.id, parent_id, student_id, created_by: profile.id }, { onConflict: 'parent_id,student_id' })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

// DELETE /api/school/parent-links
// Body: { school, link_id }
export async function DELETE(request) {
  const body = await request.json();
  const { school: schoolSlug, link_id } = body;
  if (!schoolSlug || !link_id) {
    return NextResponse.json({ error: 'Missing school or link_id.' }, { status: 400 });
  }

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { error: deleteError } = await supabase
    .from('parent_links')
    .delete()
    .eq('id', link_id)
    .eq('school_id', school.id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
