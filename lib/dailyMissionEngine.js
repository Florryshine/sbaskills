import { createAdminClient } from '@/lib/supabase-admin';

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function pct(score, total) {
  return total > 0 ? (score / total) * 100 : null;
}

function pickQuestions(rows, count) {
  return [...rows].sort(() => Math.random() - 0.5).slice(0, count).map(q => q.id);
}

export async function generateDailyMissionForStudent({ userId, curriculumId, subjects = [] }) {
  const supabase = createAdminClient();
  const date = todayUTC();

  const { data: existing } = await supabase
    .from('student_daily_missions')
    .select('id, status')
    .eq('user_id', userId)
    .eq('curriculum_id', curriculumId)
    .eq('mission_date', date)
    .maybeSingle();

  if (existing) return { ...existing, created: false };

  const { data: attempts } = await supabase
    .from('jamb_practice_attempts')
    .select('subject, score, total_questions, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(50);

  const subjectStats = {};
  for (const a of attempts || []) {
    if (!a.subject) continue;
    const s = subjectStats[a.subject] ||= { score: 0, total: 0 };
    s.score += a.score || 0;
    s.total += a.total_questions || 0;
  }

  const availableSubjects = [...new Set(subjects.filter(Boolean))];
  const rankedSubjects = availableSubjects.sort((a, b) =>
    (pct(subjectStats[a]?.score || 0, subjectStats[a]?.total || 0) ?? -1) -
    (pct(subjectStats[b]?.score || 0, subjectStats[b]?.total || 0) ?? -1)
  );

  const selectedSubjects = rankedSubjects.slice(0, 3);
  if (!selectedSubjects.length) selectedSubjects.push('English', 'Mathematics', 'Biology');

  const { data: questions } = await supabase
    .from('past_questions')
    .select('id, subject')
    .eq('exam_type', 'JAMB')
    .in('subject', selectedSubjects)
    .limit(300);

  const bySubject = {};
  for (const q of questions || []) (bySubject[q.subject] ||= []).push(q);

  const items = selectedSubjects.map((subject, index) => ({
    item_order: index + 1,
    activity_type: 'practice',
    subject,
    topic: null,
    question_ids: pickQuestions(bySubject[subject] || [], 10),
    target_count: 10,
  })).filter(i => i.question_ids.length);

  if (!items.length) throw new Error('No JAMB practice questions are available for the selected subjects.');

  const { data: mission, error } = await supabase
    .from('student_daily_missions')
    .insert({
      user_id: userId,
      curriculum_id: curriculumId,
      mission_date: date,
      title: "Today's JAMB Mission",
      target_minutes: items.length * 10,
    })
    .select()
    .single();

  if (error) throw error;

  const { error: itemError } = await supabase
    .from('student_daily_mission_items')
    .insert(items.map(i => ({ ...i, mission_id: mission.id })));

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
    title: "🎯 Today's JAMB mission is ready",
    body: 'Your personalised practice is waiting. Complete today\'s mission and keep your streak going.',
    action_url: '/dashboard',
    metadata: { mission_id: missionId },
  }).select().single();

  if (error) throw error;
  return data;
}
