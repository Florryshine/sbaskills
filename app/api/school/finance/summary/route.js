import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';
function principalOnly(profile) { return profile.role === 'principal' || profile.role === 'admin'; }
function monthRange(month) { const start = new Date(`${month}-01T00:00:00Z`); if (Number.isNaN(start.getTime())) return null; const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1); return { start: start.toISOString(), end: end.toISOString(), dateStart: month + '-01', dateEnd: end.toISOString().slice(0, 10) }; }

export async function GET(request) {
  const { searchParams } = new URL(request.url); const slug = searchParams.get('school'); const month = searchParams.get('month'); const term = searchParams.get('term'); const session = searchParams.get('session');
  if (!slug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });
  const result = await requireSchoolStaff(slug); if (result.error) return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  const { supabase, profile, school } = result; if (!principalOnly(profile)) return NextResponse.json({ error: 'Only a principal or admin can view school finance.' }, { status: 403 });
  let income = 0; let incomeRows = [];
  if (term && session) {
    const { data: structures } = await supabase.from('fee_structures').select('id').eq('school_id', school.id).eq('term', term).eq('session', session);
    const ids = (structures || []).map(row => row.id);
    if (ids.length) { const { data } = await supabase.from('fee_payments').select('amount').eq('school_id', school.id).eq('status', 'confirmed').in('fee_structure_id', ids); incomeRows = data || []; }
  } else {
    const range = monthRange(month || new Date().toISOString().slice(0, 7));
    const { data } = await supabase.from('fee_payments').select('amount').eq('school_id', school.id).eq('status', 'confirmed').gte('paid_at', range.start).lt('paid_at', range.end); incomeRows = data || [];
  }
  income = incomeRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  let expensesQuery = supabase.from('school_expenses').select('id, category, description, amount, expense_date, created_at').eq('school_id', school.id).order('expense_date', { ascending: false });
  if (term && session) {
    const { data: structures } = await supabase.from('fee_structures').select('id').eq('school_id', school.id).eq('term', term).eq('session', session);
    const ids = (structures || []).map(row => row.id);
    const { data: payments } = ids.length ? await supabase.from('fee_payments').select('paid_at').eq('school_id', school.id).eq('status', 'confirmed').in('fee_structure_id', ids).order('paid_at', { ascending: true }).limit(1) : { data: [] };
    const first = payments?.[0]?.paid_at; if (first) { const start = new Date(first); const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 4); expensesQuery = expensesQuery.gte('expense_date', start.toISOString().slice(0, 10)).lt('expense_date', end.toISOString().slice(0, 10)); }
  } else { const range = monthRange(month || new Date().toISOString().slice(0, 7)); expensesQuery = expensesQuery.gte('expense_date', range.dateStart).lt('expense_date', range.dateEnd); }
  const { data: expenses, error } = await expensesQuery; if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const breakdown = (expenses || []).reduce((map, expense) => { map[expense.category] = (map[expense.category] || 0) + Number(expense.amount || 0); return map; }, {});
  const totalExpenses = (expenses || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return NextResponse.json({ income, total_expenses: totalExpenses, net: income - totalExpenses, breakdown, expenses: expenses || [], filter: { month, term, session } });
}
