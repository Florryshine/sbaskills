import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateDailyMissionForStudent, createDailyMissionNotification } from '@/lib/dailyMissionEngine';
import { authorizeCronRequest } from '@/lib/cronAuth';

export async function GET(request) {
  const authError = authorizeCronRequest(request, 'x-cron-secret');
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data: curriculum } = await supabase
    .from('curricula')
    .select('id, code, exam_type')
    .eq('code', 'JAMB_UTME_2027')
    .eq('status', 'active')
    .single();

  if (!curriculum) return NextResponse.json({ error: 'JAMB curriculum not configured' }, { status: 500 });

  const { data: students, error } = await supabase
    .from('profiles')
    .select('id, target_exams, interests')
    .contains('target_exams', ['JAMB'])
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let generated = 0;
  let skipped = 0;
  for (const student of students || []) {
    try {
      const mission = await generateDailyMissionForStudent({
        userId: student.id,
        curriculumId: curriculum.id,
        subjects: student.interests || ['English', 'Mathematics', 'Biology'],
      });
      if (mission?.created) {
        await createDailyMissionNotification(student.id, mission.id);
        generated++;
      } else skipped++;
    } catch (e) {
      console.error('Daily mission failed for', student.id, e);
      skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    date: new Date().toISOString().slice(0, 10),
    generated,
    skipped,
  });
}
