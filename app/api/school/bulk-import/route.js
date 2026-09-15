import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { requireSchoolStaff } from '@/lib/school/auth';
import { parseCsv } from '@/lib/school/csv';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  const body = await request.json(); if (!body.school || !body.role || !body.csv) return NextResponse.json({ error: 'school, role, and csv are required.' }, { status: 400 });
  const result = await requireSchoolStaff(body.school); if (result.error) return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  const { supabase, school, profile } = result;
  const admin = createSupabaseAdmin();
  const rows = parseCsv(body.csv); if (!rows.length) return NextResponse.json({ error: 'No rows found in CSV.' }, { status: 400 });
  const job = await supabase.from('bulk_import_jobs').insert({ school_id: school.id, imported_by: profile.id, role: body.role, file_name: body.file_name, total_rows: rows.length }).select().single();
  let success = 0, errors = [];
  for (const row of rows) {
    try {
      if (!row.email || !row.full_name) throw new Error('Missing email or full_name');
      const { data: authUser, error: authErr } = await admin.auth.admin.createUser({ email: row.email, password: Math.random().toString(36).slice(-10), email_confirm: true });
      if (authErr) throw authErr;
      const { error: profErr } = await admin.from('profiles').insert({ id: authUser.user.id, school_id: school.id, full_name: row.full_name, role: body.role, student_level: row.student_level || null, whatsapp_number: row.whatsapp_number || null });
      if (profErr) throw profErr;
      success++;
    } catch (e) { errors.push({ email: row.email, error: e.message }); }
  }
  await supabase.from('bulk_import_jobs').update({ success_count: success, error_count: errors.length, errors }).eq('id', job.data.id);
  return NextResponse.json({ success, error_count: errors.length, errors });
}
