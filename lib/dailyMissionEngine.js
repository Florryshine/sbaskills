import { createAdminClient } from '@/lib/supabase-admin';

function todayNigeriaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function pickQuestions(rows, count) {
  const copy = [...rows];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count).map((q) => q.id);
}

async function getQuestionsForSubject(supabase, subject) {
  const { data, error } = await supabase
    .from('past_questions')
    .select('id, subject, topic')
    .eq('exam_type', 'JAMB')
    .ilike('subject', subject)
    .limit(250);
  if (error) throw error;
  return data || [];
}

export async function generateDailyMissionForStudent({ userId, curriculumId, subjects = [] }) {
  const supabase = createAdminClient();
  const date = todayNigeriaDate();

  const { data: existing, error: existingError } = await supabase
    .from('student_daily_missions')
    .select('id, status')
    .eq('user_id', userId)
    .eq('curriculum_id', curriculumId)
    .eq('mission_date', date)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { data: existingItems, error: itemsError } = await supabase
      .from('student_daily_mission_items')
      .select('id')
      .eq('mission_id', existing.id)
      .limit(1);
    if (itemsError) throw itemsError;
    // Repair stale/incomplete missions instead of leaving the student stuck forever.
    if (existingItems?.length) return { ...existing, created: false };
    const { error: deleteError } = await supabase
      .from('student_daily_missions')
      .delete()
      .eq('id', existing.id);
    if (deleteError) throw deleteError;
  }

  const { data: masteryRows, error: masteryError } = await supabase
    .from('student_topic_mastery')
    .select('curriculum_topic_id, mastery_score, status, questions_attempted, curriculum_topics(id, subject, title)')
    .eq('user_id', userId)
    .eq('curriculum_topics.curriculum_id', curriculumId)
    .order('mastery_score', { ascending: true })
    .limit(30);
  if (masteryError) throw masteryError;

  const focusRows = (masteryRows || [])
    .filter((row) => row.curriculum_topics && row.status !== 'mastered')
    .slice(0, 6);
  const selected = [];

  // Prefer syllabus topics with questions explicitly mapped to them.
  for (const row of focusRows) {
    if (selected.length >= 3) break;
    const { data: mappedQuestions, error } = await supabase
      .from('past_questions')
      .select('id, subject, topic')
      .eq('exam_type', 'JAMB')
      .eq('curriculum_topic_id', row.curriculum_topic_id)
      .limit(100);
    if (error) throw error;
    if (!mappedQuestions?.length) continue;
    selected.push({
      subject: row.curriculum_topics.subject,
      topic: row.curriculum_topics.title,
      questions: pickQuestions(mappedQuestions, 10),
    });
  }

  // Prefer the student's selected subjects when they match the question bank.
  if (!selected.length) {
    const uniqueSubjects = [...new Set((subjects || []).filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean))];
    for (const subject of uniqueSubjects) {
      if (selected.length >= 3) break;
      const questions = await getQuestionsForSubject(supabase, subject);
      if (questions.length) selected.push({ subject: questions[0].subject || subject, topic: null, questions: pickQuestions(questions, 10) });
    }
  }

  // Interests are not always exact JAMB subject names; discover usable subjects from the bank.
  if (!selected.length) {
    const { data: questionRows, error } = await supabase
      .from('past_questions')
      .select('id, subject, topic')
      .eq('exam_type', 'JAMB')
      .not('subject', 'is', null)
      .limit(1000);
    if (error) throw error;

    const bySubject = new Map();
    for (const question of questionRows || []) {
      if (!question.subject) continue;
      if (!bySubject.has(question.subject)) bySubject.set(question.subject, []);
      bySubject.get(question.subject).push(question);
    }
    for (const [subject, questions] of bySubject.entries()) {
      if (selected.length >= 3) break;
      selected.push({ subject, topic: null, questions: pickQuestions(questions, 10) });
    }
  }

  if (!selected.length) {
    throw new Error('No JAMB practice questions are available. Check the JAMB question bank and subject labels.');
  }

  const { data: mission, error: missionError } = await supabase
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
  if (missionError) throw missionError;

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
  const { data: existing, error: existingError } = await supabase
    .from('student_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'DAILY_MISSION_READY')
    .contains('metadata', { mission_id: missionId })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase.from('student_notifications').insert({
    user_id: userId,
    type: 'DAILY_MISSION_READY',
    title: "🎯 Today's personalised JAMB mission is ready",
    body: 'Your available JAMB practice questions have been selected automatically. Complete today’s mission to keep moving.',
    action_url: '/dashboard',
    metadata: { mission_id: missionId },
  }).select().single();

  if (error) throw error;
  return data;
}
