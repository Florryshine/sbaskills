import { createRouteHandlerClient } from '@/lib/supabase-server';

/**
 * Resolves the current user + their profile, and confirms they're staff
 * (teacher/principal/admin) for the given school slug. Used by every
 * /api/school/* route so the same access rules apply everywhere:
 * - platform admins can act on any school
 * - a teacher/principal can only act on their own school (profile.school_id
 *   must match the school being addressed)
 *
 * Returns { supabase, user, profile, school, error } where error is a
 * { status, message } pair ready to hand to NextResponse.json when auth
 * fails, so callers can just `if (error) return NextResponse.json(...)`.
 */
export async function requireSchoolStaff(schoolSlug) {
  const supabase = createRouteHandlerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: { status: 401, message: 'Not signed in.' } };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, school_id, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || !['teacher', 'principal', 'admin'].includes(profile.role)) {
    return { error: { status: 403, message: 'Only school staff can do this.' } };
  }

  const { data: school } = await supabase
    .from('schools')
    .select('id, slug, name')
    .eq('slug', schoolSlug)
    .single();

  if (!school) {
    return { error: { status: 404, message: 'School not found.' } };
  }

  if (profile.role !== 'admin' && profile.school_id !== school.id) {
    return { error: { status: 403, message: "You don't have access to this school." } };
  }

  return { supabase, user, profile, school, error: null };
}
