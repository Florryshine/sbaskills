import { createAdminClient } from '@/lib/supabase-admin';

function todayNigeriaDate() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
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
    if (existingItems?.length) return { ...existing, created: false };

    // Repair a mission record that was saved without any activities.
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
  // Mastery is a preference signal, not a prerequisite for a mission.
  // If its relation/query is unavailable, continue with the question bank fallback.
  if (masteryError) {
    console.error('Daily mission mastery lookup failed; using question-bank fallback:', masteryError);
  }

  const focusRows = (masteryRows || [])
    .filter((row) => row.curriculum_topics && row.status !== 'mastered')
    .slice(0, 6);
  const selected = [];
  const selectedSubjects = new Set();

  // First choice: topics the student needs to improve, when questions are mapped.
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
    const subject = row.curriculum_topics.subject || mappedQuestions[0].subject;
    if (selectedSubjects.has(subject)) continue;
    selectedSubjects.add(subject);
    selected.push({
      subject,
      topic: row.curriculum_topics.title,
      questions: pickQuestions(mappedQuestions, 10),
    });
  }

  // Next, use selected subjects that actually exist in the question bank.
  const preferredSubjects = [...new Set((subjects || [])
    .filter((s) => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean))];
  for (const subject of preferredSubjects) {
    if (selected.length >= 3) break;
    const questions = await getQuestionsForSubject(supabase, subject);
    if (!questions.length) continue;
    const actualSubject = questions[0].subject || subject;
    if (selectedSubjects.has(actualSubject)) continue;
    selectedSubjects.add(actualSubject);
    selected.push({ subject: actualSubject, topic: null, questions: pickQuestions(questions, 10) });
  }

  // Finally, discover curriculum subjects and fetch only the questions needed for each remaining slot.
  // This avoids loading up to 1,000 full question rows for every student dashboard visit.
  if (selected.length < 3) {
    const { data: curriculumSubjectRows, error: subjectError } = await supabase
      .from('curriculum_topics')
      .select('subject')
      .eq('curriculum_id', curriculumId)
      .not('subject', 'is', null)
      .limit(1000);
    if (subjectError) throw subjectError;

    const availableSubjects = [...new Set((curriculumSubjectRows || [])
      .map((row) => (row.subject || '').trim())
      .filter(Boolean))];

    for (const subject of availableSubjects) {
      if (selected.length >= 3) break;
      if (selectedSubjects.has(subject)) continue;

      const { data: questions, error } = await supabase
        .from('past_questions')
        .select('id, subject, topic')
        .eq('exam_type', 'JAMB')
        .ilike('subject', subject)
        .limit(100);
      if (error) throw error;
      if (!questions?.length) continue;

      const actualSubject = questions[0].subject || subject;
      if (selectedSubjects.has(actualSubject)) continue;
      selectedSubjects.add(actualSubject);
      selected.push({ subject: actualSubject, topic: null, questions: pickQuestions(questions, 10) });
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

  // Two tabs can race after both observe that today's mission does not exist.
  // The unique key is the final guard; on a duplicate insert, return the winner's mission.
  if (missionError?.code === '23505') {
    const { data: racedMission, error: racedMissionError } = await supabase
      .from('student_daily_missions')
      .select('id, status, title, mission_date, target_minutes, completed_at')
      .eq('user_id', userId)
      .eq('curriculum_id', curriculumId)
      .eq('mission_date', date)
      .maybeSingle();
    if (racedMissionError) throw racedMissionError;
    if (racedMission) return { ...racedMission, created: false };
  }
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
