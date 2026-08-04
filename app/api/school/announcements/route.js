import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/announcements?school=<slug>&limit=10
// Public: used by the school landing page ("News & Announcements") and
// signed-in students/teachers/parents to see what's been sent to them.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  const limit = Number(searchParams.get('limit')) || 20;

  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const supabase = createRouteHandlerClient();
  const { data: school } = await supabase.from('schools').select('id').eq('slug', schoolSlug).single();
  if (!school) return NextResponse.json({ error: 'School not found.' }, { status: 404 });

  const { data, error } = await supabase
    .from('school_announcements')
    .select('id, title, message, audience, class_level, is_public, created_at')
    .eq('school_id', school.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data || [] });
}

// POST /api/school/announcements
// Body: { school, title, message, audience, class_level, is_public }
// Staff only (teacher/principal/admin, scoped to their own school).
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, title, message, audience, class_level, is_public } = body;

  if (!schoolSlug || !title || !message) {
    return NextResponse.json({ error: 'Missing school, title, or message.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: insertError } = await supabase
    .from('school_announcements')
    .insert({
      school_id: school.id,
      title,
      message,
      audience: ['all', 'students', 'teachers', 'parents'].includes(audience) ? audience : 'all',
      class_level: class_level || null,
      is_public: is_public !== false,
      created_by: profile.id,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ announcement: data });
}
