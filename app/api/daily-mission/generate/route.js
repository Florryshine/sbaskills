import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateDailyMissionForStudent, createDailyMissionNotification } from '@/lib/dailyMissionEngine';

export async function POST() {
  try {
    const sessionClient = createRouteHandlerClient();
    const { data: auth, error: authError } = await sessionClient.auth.getUser();
    if (authError || !auth?.user) return NextResponse.json({ error: 'Please sign in to prepare your mission.' }, { status: 401 });

    const admin = createAdminClient();
    const userId = auth.user.id;
    const { data: profile, error: profileError } = await admin
      .from('profiles').select('target_exams, interests').eq('id', userId).maybeSingle();
    if (profileError) throw profileError;
    if (!(profile?.target_exams || []).includes('JAMB')) {
      return NextResponse.json({ error: 'Choose JAMB in your exam targets before generating a JAMB mission.' }, { status: 400 });
    }

    const { data: target, error: targetError } = await admin
      .from('student_exam_targets').select('curriculum_id')
      .eq('user_id', userId).eq('exam_type', 'JAMB').eq('status', 'active')
      .order('exam_year', { ascending: false }).limit(1).maybeSingle();
    if (targetError) throw targetError;

    let curriculumId = target?.curriculum_id || null;
    if (!curriculumId) {
      const { data: curriculum, error: curriculumError } = await admin
        .from('curricula').select('id').eq('code', 'JAMB_UTME_2027').eq('status', 'active').maybeSingle();
      if (curriculumError) throw curriculumError;
      curriculumId = curriculum?.id || null;
    }
    if (!curriculumId) return NextResponse.json({ error: 'The active JAMB curriculum is not configured yet.' }, { status: 503 });

    const mission = await generateDailyMissionForStudent({
      userId,
      curriculumId,
      subjects: profile?.interests || ['English', 'Mathematics', 'Biology'],
    });
    if (mission?.created) await createDailyMissionNotification(userId, mission.id);
    return NextResponse.json({ success: true, mission });
  } catch (error) {
    console.error('On-demand daily mission generation failed:', error);
    return NextResponse.json({ error: 'We could not prepare your mission right now. You can still start quick practice.' }, { status: 500 });
  }
}