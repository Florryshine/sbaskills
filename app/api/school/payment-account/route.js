import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';
import { paystackRequest } from '@/lib/school/paystack';

export const dynamic = 'force-dynamic';

function forbiddenUnlessPrincipal(profile) {
  return profile.role !== 'principal' && profile.role !== 'admin';
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('school');
  if (!slug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });
  const result = await requireSchoolStaff(slug);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  const { school } = result;
  try {
    const banks = await paystackRequest('/bank?country=nigeria&perPage=100');
    return NextResponse.json({
      status: school.payment_account_status || 'not_connected',
      account_name: school.paystack_account_name || null,
      bank_name: school.paystack_settlement_bank || null,
      account_number_masked: school.paystack_account_number
        ? `${'*'.repeat(Math.max(0, school.paystack_account_number.length - 4))}${school.paystack_account_number.slice(-4)}`
        : null,
      banks: banks || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { school: slug, bankCode, accountNumber } = body;
  if (!slug || !bankCode || !accountNumber) {
    return NextResponse.json({ error: 'school, bankCode, and accountNumber are required.' }, { status: 400 });
  }
  const result = await requireSchoolStaff(slug);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  const { supabase, profile, school } = result;
  if (forbiddenUnlessPrincipal(profile)) {
    return NextResponse.json({ error: 'Only a principal or admin can connect the payment account.' }, { status: 403 });
  }
  if (!/^\d{10}$/.test(String(accountNumber))) {
    return NextResponse.json({ error: 'Nigerian account numbers must contain exactly 10 digits.' }, { status: 400 });
  }

  try {
    const resolved = await paystackRequest(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
    const banks = await paystackRequest('/bank?country=nigeria&perPage=100');
    const selectedBank = (banks || []).find(bank => String(bank.code) === String(bankCode));
    const subaccount = await paystackRequest('/subaccount', {
      method: 'POST',
      body: JSON.stringify({
        business_name: school.name,
        bank_code: String(bankCode),
        account_number: String(accountNumber),
        percentage_charge: Number(school.platform_fee_percent || 5),
        primary_contact_email: process.env.RESEND_FROM_EMAIL || undefined,
      }),
    });

    const { data: updated, error: updateError } = await supabase
      .from('schools')
      .update({
        paystack_subaccount_code: subaccount.subaccount_code,
        paystack_bank_code: String(bankCode),
        paystack_account_number: String(accountNumber),
        paystack_account_name: resolved.account_name || subaccount.account_name || null,
        paystack_settlement_bank: selectedBank?.name || subaccount.settlement_bank || null,
        payment_account_status: 'connected',
      })
      .eq('id', school.id)
      .select('payment_account_status, paystack_account_name, paystack_settlement_bank, paystack_account_number')
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({
      status: updated.payment_account_status,
      account_name: updated.paystack_account_name,
      bank_name: updated.paystack_settlement_bank,
      account_number_masked: `********${String(updated.paystack_account_number).slice(-4)}`,
    });
  } catch (error) {
    await supabase.from('schools').update({ payment_account_status: 'failed' }).eq('id', school.id);
    return NextResponse.json({ error: `Payment account connection failed: ${error.message}` }, { status: 502 });
  }
}
