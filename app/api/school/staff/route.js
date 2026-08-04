import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET /api/school/staff?school=<slug>&role=teacher|student|parent
// Lists people at a school by role. Any school staff member can list.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  const role = searchParams.get('role');
  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, role, student_level, assigned_classes, is_active, created_at')
    .eq('school_id', school.id)
    .order('created_at', { ascending: false });

  if (role) query = query.eq('role', role);

  const { data, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ people: data || [] });
}

// POST /api/school/staff
// Body: { school, full_name, email, password, role, student_level? }
// Creates a brand-new account scoped to this school.
// Who can create whom:
//   - admin        -> anyone (teacher, principal, student, parent)
//   - principal     -> teacher, student, parent (not another principal)
//   - teacher       -> student, parent only
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, full_name, email, password, role, student_level } = body;

  if (!schoolSlug || !full_name || !email || !password || !role) {
    return NextResponse.json({ error: 'Missing school, full_name, email, password, or role.' }, { status: 400 });
  }
  if (!['teacher', 'principal', 'student', 'parent'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const canCreate = {
    admin: ['teacher', 'principal', 'student', 'parent'],
    principal: ['teacher', 'student', 'parent'],
    teacher: ['student', 'parent'],
  };
  if (!canCreate[profile.role]?.includes(role)) {
    return NextResponse.json({ error: `A ${profile.role} cannot create a ${role} account.` }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message || 'Could not create account.' }, { status: 400 });
  }

  const { data: newProfile, error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: created.user.id,
      full_name,
      email,
      role,
      school_id: school.id,
      student_level: role === 'student' ? (student_level || null) : null,
      is_active: true,
    })
    .select()
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ person: newProfile });
}

// PATCH /api/school/staff
// Body: { school, user_id, role? , is_active?, assigned_classes? }
// Used for: admin promoting a user to principal, deactivating an account,
// or updating a teacher's assigned classes.
export async function PATCH(request) {
  const body = await request.json();
  const { school: schoolSlug, user_id, role, is_active, assigned_classes } = body;

  if (!schoolSlug || !user_id) {
    return NextResponse.json({ error: 'Missing school or user_id.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const updates = {};
  if (role !== undefined) {
    // Only an admin can promote someone to (or demote from) principal.
    if (role === 'principal' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Only a platform admin can assign the principal role.' }, { status: 403 });
    }
    updates.role = role;
  }
  if (is_active !== undefined) updates.is_active = is_active;
  if (assigned_classes !== undefined) updates.assigned_classes = assigned_classes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const { data, error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user_id)
    .eq('school_id', school.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ person: data });
}
