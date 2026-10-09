import { createAdminClient } from '@/lib/supabase-admin';

function todayNigeriaDate() {
  // Nigeria uses West Africa Time (UTC+1) year-round; missions should roll over at local midnight.
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

function pickQuestions(rows, count) {
  return [...rows].sort(() => Math.random() - 0.5).slice(0, count).map(q => q.id);
}

export async function generateDailyMissionForStudent({ userId, curriculumId, subjects = [] }) {
  const supabase = createAdminClient();
  const date = todayNigeriaDate();

  const { data: existing } = await supabase
    .from('student_daily_missions')
    .select('id, status')
    .eq('user_id', userId)
    .eq('curriculum_id', curriculumId)
    .eq('mission_date', date)
    .maybeSingle();

  if (existing) return { ...existing, created: false };

  // Phase B: use curriculum mastery first. The mission should close gaps,
  // not simply rotate through the student's strongest subjects.
  const { data: masteryRows } = await supabase
    .from('student_topic_mastery')
    .select('curriculum_topic_id, mastery_score, status, questions_attempted, curriculum_topics(id, subject, title)')
    .eq('user_id', userId)
    .eq('curriculum_topics.curriculum_id', curriculumId)
    .order('mastery_score', { ascending: true })
    .limit(30);

  const focusRows = (masteryRows || [])
    .filter(row => row.curriculum_topics && row.status !== 'mastered')
    .slice(0, 6);

  const selected = [];

  // Prefer weak mapped topics with actual questions.
  for (const row of focusRows) {
    if (selected.length >= 3) break;
    const { data: mappedQuestions } = await supabase
      .from('past_questions')
      .select('id, subject, topic')
      .eq('exam_type', 'JAMB')
      .eq('curriculum_topic_id', row.curriculum_topic_id)
      .limit(30);

    if (!mappedQuestions?.length) continue;
    selected.push({
      subject: row.curriculum_topics.subject,
      topic: row.curriculum_topics.title,
      curriculumTopicId: row.curriculum_topic_id,
      questions: pickQuestions(mappedQuestions, 10),
    });
  }

  // Safe fallback for curriculum topics that are not mapped to questions yet.
  if (!selected.length) {
    const availableSubjects = [...new Set(subjects.filter(Boolean))];
    for (const subject of availableSubjects.slice(0, 3)) {
      const { data: questions } = await supabase
        .from('past_questions')
        .select('id, subject, topic')
        .eq('exam_type', 'JAMB')
        .eq('subject', subject)
        .limit(100);

      if (questions?.length) {
        selected.push({ subject, topic: null, curriculumTopicId: null, questions: pickQuestions(questions, 10) });
      }
    }
  }

  if (!selected.length) {
    throw new Error('No JAMB practice questions are available for the selected learning focus.');
  }

  const { data: mission, error } = await supabase
    .from('student_daily_missions')
    .insert({
      user_id: userId,
      curriculum_id: curriculumId,
      mission_date: date,
      title: "Today's Personalised JAMB Mission",
      target_minutes: selected.length * 10,
    })
    .select()
    .single();

  if (error) throw error;

  const { error: itemError } = await supabase
    .from('student_daily_mission_items')
    .insert(selected.map((item, index) => ({
      mission_id: mission.id,
      item_order: index + 1,
      activity_type: 'practice',
      subject: item.subject,
      topic: item.topic,
      question_ids: item.questions,
      target_count: item.questions.length,
    })));

  if (itemError) {
    await supabase.from('student_daily_missions').delete().eq('id', mission.id);
    throw itemError;
  }

  return { ...mission, created: true };
}

export async function createDailyMissionNotification(userId, missionId) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('student_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'DAILY_MISSION_READY')
    .contains('metadata', { mission_id: missionId })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase.from('student_notifications').insert({
    user_id: userId,
    type: 'DAILY_MISSION_READY',
    title: "🎯 Today's personalised JAMB mission is ready",
    body: 'Your weakest available areas were selected automatically. Complete today\'s mission to keep moving.',
    action_url: '/dashboard',
    metadata: { mission_id: missionId },
  }).select().single();

  if (error) throw error;
  return data;
}
