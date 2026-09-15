import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { school: slug, category, description, amount, expense_date: expenseDate } = body;
  if (!slug || !category || !description || amount === undefined || !expenseDate) return NextResponse.json({ error: 'school, category, description, amount, and expense_date are required.' }, { status: 400 });
  const result = await requireSchoolStaff(slug); if (result.error) return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  const { supabase, profile, school } = result;
  if (!['principal', 'admin'].includes(profile.role)) return NextResponse.json({ error: 'Only a principal or admin can record expenses.' }, { status: 403 });
  const numericAmount = Number(amount); if (!Number.isFinite(numericAmount) || numericAmount < 0) return NextResponse.json({ error: 'amount must be a non-negative number.' }, { status: 400 });
  const { data, error } = await supabase.from('school_expenses').insert({ school_id: school.id, category: String(category).trim(), description: String(description).trim(), amount: numericAmount, expense_date: expenseDate, recorded_by: profile.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}
