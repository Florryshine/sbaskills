// Converts a boss_battle_drafts row's `questions` array (AI-generated, shape:
// { question, options: [4 strings], correct_answer, explanation, difficulty })
// into rows in past_questions, using the option_a/b/c/d columns that
// app/boss/page.js, app/challenge/page.js, and the past-questions browser
// actually read — NOT an `options` array, which those pages don't look at.
//
// Mirrors the delete-then-reinsert pattern used by syncQuizToPastQuestions.js
// so re-publishing a draft cleanly replaces its previously-synced questions
// rather than duplicating them.

export async function syncBossBattleDraftToPastQuestions(supabase, draftId, draft) {
  await supabase
    .from('past_questions')
    .delete()
    .eq('source_type', 'boss_battle_draft')
    .eq('source_id', draftId);

  const questions = draft.questions || [];
  const insertedIds = [];

  for (const q of questions) {
    const opts = q.options || [];
    // The AI returns correct_answer as the matching option's full text, but
    // app/boss/page.js and app/challenge/page.js compare the student's pick
    // against a single letter ('a'|'b'|'c'|'d') — same convention as CSV-
    // uploaded past_questions. Map text -> letter here so answers actually work.
    const letters = ['a', 'b', 'c', 'd'];
    let correctLetter = null;
    const idx = opts.findIndex(
      (o) => (o || '').trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase()
    );
    if (idx !== -1) {
      correctLetter = letters[idx];
    } else if (letters.includes((q.correct_answer || '').trim().toLowerCase())) {
      // Already a letter — use as-is.
      correctLetter = q.correct_answer.trim().toLowerCase();
    }

    if (!correctLetter) {
      console.error('Could not resolve correct_answer to a letter, skipping question:', q.question);
      continue;
    }

    const { data, error } = await supabase
      .from('past_questions')
      .insert({
        subject: draft.subject || '',
        topic: draft.topic || '',
        question: q.question,
        option_a: opts[0] || '',
        option_b: opts[1] || '',
        option_c: opts[2] || '',
        option_d: opts[3] || '',
        correct_answer: correctLetter,
        explanation: q.explanation || '',
        source_type: 'boss_battle_draft',
        source_id: draftId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting boss battle question into past_questions:', error);
      continue;
    }
    insertedIds.push(data.id);
  }

  return insertedIds;
}