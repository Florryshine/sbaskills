import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { requireSchoolStaff } from '@/lib/school/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const { searchParams } = new URL(request.url); const slug = searchParams.get('school'); const classLevel = searchParams.get('class_level');
  if (!slug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });
  const supabase = createRouteHandlerClient();
  const { data: school } = await supabase.from('schools').select('id, slug, name').eq('slug', slug).single();
  if (!school) return NextResponse.json({ error: 'School not found.' }, { status: 404 });
  let query = supabase.from('timetable_slots').select('id, school_id, class_level, day_of_week, period_number, start_time, end_time, subject, teacher_id, is_published, teacher:teacher_id(full_name)').eq('school_id', school.id).order('day_of_week').order('period_number');
  if (classLevel) query = query.eq('class_level', classLevel);
  const { data, error } = await query; if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ school, slots: data || [] });
}
async function writeContext(slug) {
  const result = await requireSchoolStaff(slug);
  if (result.error) return { response: NextResponse.json({ error: result.error.message }, { status: result.error.status }) };
  if (!['principal', 'admin'].includes(result.profile.role)) return { response: NextResponse.json({ error: 'Only the principal or platform admin can edit the timetable.' }, { status: 403 }) };
  return result;
}
function validSlot(body) {
  return body.class_level && Number(body.day_of_week) >= 1 && Number(body.day_of_week) <= 7 && Number(body.period_number) > 0 && body.start_time && body.end_time && body.subject;
}
export async function POST(request) {
  const body = await request.json().catch(() => ({})); if (!body.school || !validSlot(body)) return NextResponse.json({ error: 'school, class_level, day_of_week, period_number, start_time, end_time, and subject are required.' }, { status: 400 });
  const result = await writeContext(body.school); if (result.response) return result.response;
  const { supabase, school } = result;
  if (body.teacher_id) { const { data: teacher } = await supabase.from('profiles').select('id').eq('id', body.teacher_id).eq('school_id', school.id).in('role', ['teacher', 'principal']).maybeSingle(); if (!teacher) return NextResponse.json({ error: 'Teacher is not in this school.' }, { status: 400 }); }
  const { data, error } = await supabase.from('timetable_slots').insert({ school_id: school.id, class_level: String(body.class_level).trim(), day_of_week: Number(body.day_of_week), period_number: Number(body.period_number), start_time: body.start_time, end_time: body.end_time, subject: String(body.subject).trim(), teacher_id: body.teacher_id || null, is_published: body.is_published !== false }).select().single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'That class/day/period already has a timetable slot.' : error.message }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ slot: data });
}
export async function PATCH(request) {
  const body = await request.json().catch(() => ({})); if (!body.school || !body.id || !validSlot(body)) return NextResponse.json({ error: 'school, id, and all slot fields are required.' }, { status: 400 });
  const result = await writeContext(body.school); if (result.response) return result.response;
  const { supabase, school } = result;
  const { data, error } = await supabase.from('timetable_slots').update({ class_level: String(body.class_level).trim(), day_of_week: Number(body.day_of_week), period_number: Number(body.period_number), start_time: body.start_time, end_time: body.end_time, subject: String(body.subject).trim(), teacher_id: body.teacher_id || null, is_published: body.is_published !== false }).eq('id', body.id).eq('school_id', school.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ slot: data });
}
export async function DELETE(request) {
  const body = await request.json().catch(() => ({})); if (!body.school || !body.id) return NextResponse.json({ error: 'school and id are required.' }, { status: 400 });
  const result = await writeContext(body.school); if (result.response) return result.response;
  const { supabase, school } = result; const { error } = await supabase.from('timetable_slots').delete().eq('id', body.id).eq('school_id', school.id); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ success: true });
}
