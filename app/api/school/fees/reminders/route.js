import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';
import { sendEmail, sendWhatsApp, naira } from '@/lib/school/notify';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });
  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  const { data, error: queryError } = await supabase
    .from('fee_reminders')
    .select('id, student_id, fee_structure_id, channel, status, message, provider, provider_message_id, error_message, sent_at, created_at, student:student_id(full_name, email, whatsapp_number), fee_structure:fee_structure_id(title)')
    .eq('school_id', school.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ reminders: data || [] });
}

function channelsFor(value) {
  if (value === 'both') return ['email', 'whatsapp'];
  return [value || 'email'];
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { school: schoolSlug, student_ids: studentIds, fee_structure_id: feeStructureId, channel, message } = body;
  if (!schoolSlug || !Array.isArray(studentIds) || studentIds.length === 0 || !['email', 'whatsapp', 'both'].includes(channel)) {
    return NextResponse.json({ error: 'school, student_ids, and channel (email, whatsapp, or both) are required.' }, { status: 400 });
  }
  if (studentIds.length > 500) return NextResponse.json({ error: 'A reminder batch is limited to 500 students.' }, { status: 400 });
  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  const { data: students, error: studentsError } = await supabase
    .from('profiles').select('id, full_name, email, whatsapp_number')
    .eq('school_id', school.id).eq('role', 'student').in('id', studentIds);
  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 });
  const { data: fee } = feeStructureId
    ? await supabase.from('fee_structures').select('title, amount').eq('id', feeStructureId).eq('school_id', school.id).maybeSingle()
    : { data: null };
  const results = [];
  for (const studentId of studentIds) {
    const student = (students || []).find(row => row.id === studentId);
    for (const requestedChannel of channelsFor(channel)) {
      const content = message || `Dear parent/guardian, ${student?.full_name || 'your child'} has an outstanding ${fee?.title || 'school fee'} balance at ${school.name}. Please contact the school office for payment details.`;
      let outcome = { status: 'failed', provider: requestedChannel === 'email' ? 'resend' : 'whatsapp_cloud', providerMessageId: null, errorMessage: 'Student is not in this school.' };
      try {
        if (!student) throw new Error('Student is not in this school.');
        if (requestedChannel === 'email') {
          if (!student.email) throw new Error('No email address on file.');
          outcome = { ...(await sendEmail({ to: student.email, subject: `${school.name} fee reminder`, html: `<p>${content.replace(/\n/g, '<br/>')}</p>${fee ? `<p>Amount currently listed: <strong>${naira(fee.amount)}</strong></p>` : ''}` })), status: 'sent', errorMessage: null };
        } else {
          if (!student.whatsapp_number) throw new Error('No WhatsApp number on file.');
          outcome = { ...(await sendWhatsApp({ to: student.whatsapp_number, message: content })), status: 'sent', errorMessage: null };
        }
      } catch (sendError) {
        outcome.errorMessage = sendError.message;
      }
      const saved = await supabase.from('fee_reminders').insert({
        school_id: school.id, student_id: studentId, fee_structure_id: feeStructureId || null,
        channel: requestedChannel, status: outcome.status, message: content, sent_by: profile.id,
        provider: outcome.provider, provider_message_id: outcome.providerMessageId,
        error_message: outcome.errorMessage, sent_at: outcome.status === 'sent' ? new Date().toISOString() : null,
      }).select('id, status, channel, provider, provider_message_id, error_message').single();
      results.push({ student_id: studentId, channel: requestedChannel, ...(saved.data || { status: 'failed', error_message: saved.error?.message || 'Could not save reminder outcome.' }) });
    }
  }
  const sentCount = results.filter(result => result.status === 'sent').length;
  const failedCount = results.length - sentCount;
  if (sentCount > 0) await supabase.from('school_notifications').insert({
    school_id: school.id, type: 'fee_reminder', title: 'Fee reminders sent',
    body: `${sentCount} reminder${sentCount === 1 ? '' : 's'} sent; ${failedCount} failed.`, link: `/school/${school.slug}/fees`,
  });
  return NextResponse.json({ sentCount, failedCount, results });
}
