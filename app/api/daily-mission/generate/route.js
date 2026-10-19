import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateDailyMissionForStudent, createDailyMissionNotification } from '@/lib/dailyMissionEngine';

export async function POST() {
  try {
    const sessionClient = createRouteHandlerClient();
    const { data: auth, error: authError } = await sessionClient.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json({ error: 'Please sign in to prepare your mission.' }, { status: 401 });
    }

    const admin = createAdminClient();
    const userId = auth.user.id;

    const { data: profile, error: profileError } = await admin
      .from('profiles').select('interests').eq('id', userId).maybeSingle();
    if (profileError) throw profileError;

    const { data: target, error: targetError } = await admin
      .from('student_exam_targets').select('curriculum_id, exam_year')
      .eq('user_id', userId).eq('exam_type', 'JAMB').eq('status', 'active')
      .order('exam_year', { ascending: false }).limit(1).maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      return NextResponse.json({ error: 'Select JAMB as an active exam target before generating a mission.' }, { status: 400 });
    }

    let curriculumId = target.curriculum_id || null;
    if (!curriculumId) {
      const { data: matchingCurriculum, error: matchingError } = await admin
        .from('curricula').select('id')
        .eq('exam_type', 'JAMB').eq('status', 'active')
        .lte('effective_from_year', target.exam_year)
        .gte('effective_to_year', target.exam_year)
        .order('effective_from_year', { ascending: false }).limit(1).maybeSingle();
      if (matchingError) throw matchingError;
      curriculumId = matchingCurriculum?.id || null;

      // Older curriculum records may not have effective-year bounds populated.
      if (!curriculumId) {
        const { data: fallbackCurriculum, error: fallbackError } = await admin
          .from('curricula').select('id')
          .eq('exam_type', 'JAMB').eq('status', 'active')
          .order('effective_from_year', { ascending: false, nullsFirst: false })
          .limit(1).maybeSingle();
        if (fallbackError) throw fallbackError;
        curriculumId = fallbackCurriculum?.id || null;
      }
    }

    if (!curriculumId) {
      return NextResponse.json({
        error: 'The JAMB syllabus is not configured yet. Please contact Shiney Brain Academy support.',
      }, { status: 503 });
    }

    const mission = await generateDailyMissionForStudent({
      userId,
      curriculumId,
      subjects: Array.isArray(profile?.interests) ? profile.interests : [],
    });

    if (mission?.created) await createDailyMissionNotification(userId, mission.id);
    return NextResponse.json({ success: true, mission });
  } catch (error) {
    console.error('On-demand daily mission generation failed:', error);
    return NextResponse.json({
      error: 'We could not prepare your mission right now. Please try again. If it keeps failing, contact Shiney Brain Academy support.',
    }, { status: 500 });
  }
}
