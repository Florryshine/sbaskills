import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/school/me?school=<slug>
// Returns the signed-in user's own profile (role, school_id, name) plus
// whether that role matches the requested school. Used by client pages to
// decide what controls to show (e.g. only a principal sees "add teacher").
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');

  const supabase = createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ profile: null }, { status: 200 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, school_id, assigned_classes')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ profile: null });

  let school = null;
  if (schoolSlug) {
    const { data: schoolRow } = await supabase
      .from('schools')
      .select('id, slug, name')
      .eq('slug', schoolSlug)
      .single();
    school = schoolRow || null;
  }

  const matchesSchool = profile.role === 'admin' || (school && profile.school_id === school.id);

  return NextResponse.json({ profile, school, matchesSchool });
}
