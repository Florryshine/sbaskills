import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateDailyMissionForStudent, createDailyMissionNotification } from '@/lib/dailyMissionEngine';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request) {
  if (CRON_SECRET && request.headers.get('x-cron-secret') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      if (mission?.id) {
        await createDailyMissionNotification(student.id, mission.id);
        generated++;
      } else skipped++;
    } catch (e) {
      console.error('Daily mission failed for', student.id, e);
      skipped++;
    }
  }

  return NextResponse.json({ success: true, date: today, generated, skipped });
}
