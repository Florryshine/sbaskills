import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

function principalOnly(profile) {
  return profile.role === 'principal' || profile.role === 'admin';
}

function validLines(lines) {
  return (Array.isArray(lines) ? lines : []).map(line => ({ label: String(line.label || '').trim(), amount: Number(line.amount || 0) })).filter(line => line.label && Number.isFinite(line.amount) && line.amount >= 0);
}

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('school');
  if (!slug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });
  const { supabase, school, error } = await requireSchoolStaff(slug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  const { data, error: queryError } = await supabase.from('staff_salaries').select('id, staff_id, basic_salary, allowances, deductions, effective_from, created_at, staff:staff_id(full_name, email, role, is_active)').eq('school_id', school.id).order('effective_from', { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ salaries: data || [] });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { school: slug, staff_id: staffId, basic_salary: basicSalary, allowances, deductions, effective_from: effectiveFrom } = body;
  if (!slug || !staffId || basicSalary === undefined || !effectiveFrom) return NextResponse.json({ error: 'school, staff_id, basic_salary, and effective_from are required.' }, { status: 400 });
  const { supabase, profile, school, error } = await requireSchoolStaff(slug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  if (!principalOnly(profile)) return NextResponse.json({ error: 'Only a principal or admin can manage salaries.' }, { status: 403 });
  const numericSalary = Number(basicSalary);
  if (!Number.isFinite(numericSalary) || numericSalary < 0) return NextResponse.json({ error: 'basic_salary must be a non-negative number.' }, { status: 400 });
  const { data: staff } = await supabase.from('profiles').select('id, role').eq('id', staffId).eq('school_id', school.id).in('role', ['teacher', 'principal']).maybeSingle();
  if (!staff) return NextResponse.json({ error: 'Staff member not found in this school.' }, { status: 404 });
  const { data, error: insertError } = await supabase.from('staff_salaries').insert({ school_id: school.id, staff_id: staffId, basic_salary: numericSalary, allowances: validLines(allowances), deductions: validLines(deductions), effective_from: effectiveFrom }).select().single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ salary: data });
}
