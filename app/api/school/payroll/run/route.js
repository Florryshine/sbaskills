import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

function principalOnly(profile) { return profile.role === 'principal' || profile.role === 'admin'; }
function monthStart(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return null;
  return `${value}-01`;
}
function sumLines(lines) { return (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + Number(line.amount || 0), 0); }

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('school');
  if (!slug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });
  const { supabase, school, error } = await requireSchoolStaff(slug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  const { data, error: queryError } = await supabase.from('payroll_runs').select('id, month, status, created_at, finalized_at, payslips(id, staff_id, basic_salary, total_allowances, total_deductions, net_pay, staff:staff_id(full_name, email))').eq('school_id', school.id).order('month', { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  const runs = (data || []).map(run => ({ ...run, total_paid: (run.payslips || []).reduce((sum, slip) => sum + Number(slip.net_pay || 0), 0) }));
  return NextResponse.json({ runs });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const month = monthStart(body.month);
  const slug = body.school;
  if (!slug || !month) return NextResponse.json({ error: 'school and month (YYYY-MM) are required.' }, { status: 400 });
  const { supabase, profile, school, error } = await requireSchoolStaff(slug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  if (!principalOnly(profile)) return NextResponse.json({ error: 'Only a principal or admin can run payroll.' }, { status: 403 });
  const { data: existing } = await supabase.from('payroll_runs').select('id').eq('school_id', school.id).eq('month', month).maybeSingle();
  if (existing) return NextResponse.json({ error: 'A payroll run already exists for this school and month.' }, { status: 409 });

  const { data: staff, error: staffError } = await supabase.from('profiles').select('id, full_name, email, role, is_active').eq('school_id', school.id).in('role', ['teacher', 'principal']).eq('is_active', true);
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
  const { data: salaries, error: salaryError } = await supabase.from('staff_salaries').select('staff_id, basic_salary, allowances, deductions, effective_from').eq('school_id', school.id).lte('effective_from', month).order('effective_from', { ascending: false });
  if (salaryError) return NextResponse.json({ error: salaryError.message }, { status: 500 });

  const { data: run, error: runError } = await supabase.from('payroll_runs').insert({ school_id: school.id, month, run_by: profile.id, status: 'draft' }).select().single();
  if (runError) return NextResponse.json({ error: runError.code === '23505' ? 'A payroll run already exists for this school and month.' : runError.message }, { status: runError.code === '23505' ? 409 : 500 });
  const slips = (staff || []).map(member => {
    const salary = (salaries || []).find(row => row.staff_id === member.id);
    const basic = Number(salary?.basic_salary || 0);
    const allowances = sumLines(salary?.allowances);
    const deductions = sumLines(salary?.deductions);
    return { payroll_run_id: run.id, staff_id: member.id, basic_salary: basic, total_allowances: allowances, total_deductions: deductions, net_pay: basic + allowances - deductions };
  });
  const { data: payslips, error: payslipError } = slips.length ? await supabase.from('payslips').insert(slips).select() : { data: [], error: null };
  if (payslipError) {
    await supabase.from('payroll_runs').delete().eq('id', run.id);
    return NextResponse.json({ error: payslipError.message }, { status: 500 });
  }
  return NextResponse.json({ run: { ...run, payslips: payslips || [], total_paid: slips.reduce((sum, slip) => sum + slip.net_pay, 0) } });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const { school: slug, run_id: runId } = body;
  if (!slug || !runId) return NextResponse.json({ error: 'school and run_id are required.' }, { status: 400 });
  const { supabase, profile, school, error } = await requireSchoolStaff(slug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  if (!principalOnly(profile)) return NextResponse.json({ error: 'Only a principal or admin can finalize payroll.' }, { status: 403 });
  const { data: run } = await supabase.from('payroll_runs').select('id, status').eq('id', runId).eq('school_id', school.id).single();
  if (!run) return NextResponse.json({ error: 'Payroll run not found.' }, { status: 404 });
  if (run.status !== 'draft') return NextResponse.json({ error: 'This payroll run is already finalized and immutable.' }, { status: 409 });
  const { data, error: updateError } = await supabase.from('payroll_runs').update({ status: 'finalized', finalized_at: new Date().toISOString() }).eq('id', runId).eq('status', 'draft').select().single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ run: data });
}
