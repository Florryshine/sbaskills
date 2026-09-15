import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('school');
  if (!slug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });
  const supabase = createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { data: school } = await supabase.from('schools').select('id, slug, name').eq('slug', slug).single();
  const { data: profile } = await supabase.from('profiles').select('id, role, school_id').eq('id', user.id).single();
  if (!school || !profile || (profile.role !== 'admin' && profile.school_id !== school.id)) return NextResponse.json({ error: 'You do not have access to this school.' }, { status: 403 });
  const { data, error } = await supabase.from('payslips').select('id, payroll_run_id, basic_salary, total_allowances, total_deductions, net_pay, created_at, payroll_run:payroll_run_id(month, status, school_id)').eq('staff_id', user.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payslips: data || [] });
}
