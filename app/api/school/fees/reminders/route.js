import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/fees/reminders?school=<slug>
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: fetchError } = await supabase
    .from('fee_reminders')
    .select('id, student_id, channel, status, message, created_at, profiles:student_id(full_name, email)')
    .eq('school_id', school.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ reminders: data || [] });
}

// POST /api/school/fees/reminders
// Body: { school, student_ids: [...], fee_structure_id, channel, message }
//
// NOTE: this logs reminders to fee_reminders so staff have a record of who
// was reminded and when, and the UI can show reminder history. Actual
// delivery over email/SMS/WhatsApp isn't wired to a provider yet (no
// nodemailer/Twilio/WhatsApp credentials in this repo) -- every reminder
// is recorded as 'queued'. Plug in a provider call where marked below and
// flip the status to 'sent'/'failed' based on the real result.
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, student_ids, fee_structure_id, channel, message } = body;

  if (!schoolSlug || !Array.isArray(student_ids) || student_ids.length === 0) {
    return NextResponse.json({ error: 'Missing school or student_ids.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const finalMessage = message || 'This is a reminder that your school fees payment is outstanding. Kindly settle this at your earliest convenience.';

  const rows = student_ids.map(studentId => ({
    school_id: school.id,
    student_id: studentId,
    fee_structure_id: fee_structure_id || null,
    channel: channel && ['email', 'sms', 'whatsapp'].includes(channel) ? channel : 'email',
    status: 'queued', // TODO: call actual email/SMS/WhatsApp provider here, then set 'sent' or 'failed'
    message: finalMessage,
    sent_by: profile.id,
  }));

  const { data, error: insertError } = await supabase
    .from('fee_reminders')
    .insert(rows)
    .select();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ reminders: data, queued: data.length });
}
