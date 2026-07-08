import { createHash } from 'crypto';

export async function syncQuizDraftToPastQuestions(supabase, draftId) {
  // 1. Fetch draft with its knowledge asset
  const { data: draft, error } = await supabase
    .from('quiz_drafts')
    .select(`
      id,
      keyword,
      questions,
      knowledge_assets (
        subject,
        exam
      )
    `)
    .eq('id', draftId)
    .single();

  if (error || !draft) {
    console.error('Error fetching draft for sync:', error);
    return;
  }

  // 2. Delete existing entries for this draft
  await supabase
    .from('past_questions')
    .delete()
    .eq('source_type', 'quiz_draft')
    .eq('source_id', draftId);

  const asset = draft.knowledge_assets || {};
  const subject = asset.subject || '';
  const exam = asset.exam || '';

  // 3. Insert each question
  const questions = draft.questions || [];
  for (const q of questions) {
    // Compute hash for dedup (optional, but useful)
    const hash = createHash('md5').update(q.question).digest('hex');

    await supabase
      .from('past_questions')
      .insert({
        subject: subject,
        exam: exam,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || '',
        difficulty: q.difficulty || 1,
        topic: q.topic || '',
        source_type: 'quiz_draft',
        source_id: draftId,
        question_hash: hash,
        // You can add other fields like 'year' if available
      })
      .select();
  }
}

export async function removeQuizDraftFromPastQuestions(supabase, draftId) {
  await supabase
    .from('past_questions')
    .delete()
    .eq('source_type', 'quiz_draft')
    .eq('source_id', draftId);
}