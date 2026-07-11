import { createHash } from 'crypto';
import { resolveCorrectLetter } from './resolveCorrectLetter';

/**
 * Syncs a quiz draft's questions into past_questions.
 *
 * Design intent: past_questions is a permanent, growing question bank
 * (feeding boss battles, daily challenges, and eventually a CBT exam
 * feature) — so this must NEVER delete rows. Republishing a quiz draft
 * should not orphan any boss battle or daily challenge that already
 * points at the resulting IDs.
 *
 * Dedup is done via question_hash: if a question with the same hash
 * already exists, its row is updated in place (same id preserved).
 * Otherwise a new row is inserted.
 */
export async function syncQuizDraftToPastQuestions(supabase, draftId) {
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
    return [];
  }

  const asset = draft.knowledge_assets || {};
  const subject = asset.subject || '';
  const exam = asset.exam || '';

  const questions = draft.questions || [];
  const ids = [];

  for (const q of questions) {
    const hash = createHash('md5').update(q.question).digest('hex');
    const opts = q.options || [];
    const correctLetter = resolveCorrectLetter(opts, q.correct_answer);
    if (!correctLetter) {
      console.error('Could not resolve correct_answer to a letter, skipping question:', q.question);
      continue;
    }

    const row = {
      subject,
      exam_type: exam,
      question: q.question,
      option_a: opts[0] || '',
      option_b: opts[1] || '',
      option_c: opts[2] || '',
      option_d: opts[3] || '',
      correct_answer: correctLetter,
      explanation: q.explanation || '',
      difficulty: q.difficulty || 1,
      topic: q.topic || '',
      source_type: 'quiz_draft',
      source_id: draftId,
      question_hash: hash,
    };

    const { data: existing } = await supabase
      .from('past_questions')
      .select('id')
      .eq('question_hash', hash)
      .maybeSingle();

    if (existing) {
      await supabase.from('past_questions').update(row).eq('id', existing.id);
      ids.push(existing.id);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('past_questions')
        .insert(row)
        .select('id')
        .single();
      if (insertError) {
        console.error('Error inserting question into past_questions:', insertError);
        continue;
      }
      ids.push(inserted.id);
    }
  }

  return ids;
}

// Intentionally not called anywhere. past_questions is meant to be a
// permanent bank (see design note above), so questions should stay even
// after a quiz is unpublished or deleted. Kept only for a possible future
// explicit "purge this quiz's questions" admin action — do not wire this
// into any automatic unpublish/delete flow.
export async function removeQuizDraftFromPastQuestions(supabase, draftId) {
  await supabase
    .from('past_questions')
    .delete()
    .eq('source_type', 'quiz_draft')
    .eq('source_id', draftId);
}
