'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { syncQuizDraftToPastQuestions } from '@/lib/syncQuizToPastQuestions';

export default function QuizDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quiz_drafts')
      .select('*, knowledge_assets(keyword)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setDrafts(data || []);
    }
    setLoading(false);
  };

  const deleteDraft = async (id) => {
    if (!confirm('Delete this quiz draft?')) return;
    // Keep the corresponding main quiz and its questions hidden rather than
    // deleting historical quiz attempts that may refer to it.
    const { error: hideError } = await supabase
      .from('quizzes')
      .update({ is_published: false })
      .eq('id', id);
    if (hideError) {
      alert('Could not hide the published quiz: ' + hideError.message);
      return;
    }
    const { error } = await supabase.from('quiz_drafts').delete().eq('id', id);
    if (error) alert(error.message);
    else loadDrafts();
  };

  const updateStatus = async (id, status) => {
    const { data: draft, error: draftError } = await supabase
      .from('quiz_drafts')
      .select('*')
      .eq('id', id)
      .single();

    if (draftError || !draft) {
      alert('Could not load quiz draft: ' + (draftError?.message || 'Quiz not found'));
      return;
    }

    if (status === 'draft') {
      // Unpublish from the single student-facing quizzes list as well.
      const { error: hideError } = await supabase
        .from('quizzes')
        .update({ is_published: false })
        .eq('id', id);
      if (hideError) {
        alert('Could not unpublish quiz: ' + hideError.message);
        return;
      }
      const { error } = await supabase.from('quiz_drafts').update({ status }).eq('id', id);
      if (error) alert(error.message);
      else loadDrafts();
      return;
    }

    // Validate and normalize generated questions before making the main quiz visible.
    const questions = Array.isArray(draft.questions) ? draft.questions : [];
    const questionRows = [];
    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];
      const options = Array.isArray(q.options) ? q.options : [];
      if (
        !q.question ||
        options.length !== 4 ||
        options.some((option) => typeof option !== 'string' || !option.trim()) ||
        typeof q.correct_answer !== 'string' ||
        !options.includes(q.correct_answer)
      ) {
        alert(`Cannot publish: question ${index + 1} is missing four valid options or an answer that matches one of them.`);
        return;
      }
      questionRows.push({
        quiz_id: id,
        question: q.question,
        option_a: options[0],
        option_b: options[1],
        option_c: options[2],
        option_d: options[3],
        // quiz_questions enforces the canonical answer key a/b/c/d.
        correct_answer: ['a', 'b', 'c', 'd'][options.indexOf(q.correct_answer)],
        explanation: q.explanation || null,
        points: Number.isFinite(q.points) ? q.points : 1,
        order_index: index + 1,
      });
    }

    if (!questionRows.length) {
      alert('Cannot publish a quiz with no questions.');
      return;
    }

    // Create/update the quiz in the main quizzes table, initially hidden.
    // The same UUID keeps the admin draft and student-facing quiz linked.
    const { error: quizError } = await supabase.from('quizzes').upsert({
      id,
      title: draft.keyword,
      description: `Practice quiz on ${draft.keyword}`,
      points_reward: 10,
      time_limit_minutes: draft.estimated_minutes || 20,
      is_published: false,
      knowledge_asset_id: draft.knowledge_asset_id || null,
    }, { onConflict: 'id' });

    if (quizError) {
      alert('Could not create the quiz record: ' + quizError.message);
      return;
    }

    const { error: deleteQuestionsError } = await supabase
      .from('quiz_questions')
      .delete()
      .eq('quiz_id', id);
    if (deleteQuestionsError) {
      alert('Could not prepare quiz questions: ' + deleteQuestionsError.message);
      return;
    }

    const { error: insertQuestionsError } = await supabase
      .from('quiz_questions')
      .insert(questionRows);
    if (insertQuestionsError) {
      alert('Could not publish quiz questions: ' + insertQuestionsError.message);
      return;
    }

    const { error: draftStatusError } = await supabase
      .from('quiz_drafts')
      .update({ status: 'published' })
      .eq('id', id);
    if (draftStatusError) {
      alert('Questions were prepared, but the draft status could not be updated: ' + draftStatusError.message);
      return;
    }

    const { error: publishError } = await supabase
      .from('quizzes')
      .update({ is_published: true })
      .eq('id', id);
    if (publishError) {
      alert('Quiz is saved but still hidden from students. Publishing failed: ' + publishError.message);
      return;
    }

    try {
      await syncQuizDraftToPastQuestions(supabase, id);
    } catch (syncError) {
      console.error('Failed to sync to past_questions:', syncError);
      alert('Quiz is published, but syncing to past questions failed: ' + syncError.message);
    }
    loadDrafts();
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-6">❓ Quiz Drafts</h1>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No quiz drafts found.</div>
      ) : (
        <div className="grid gap-4">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white rounded-2xl shadow-sm border p-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{draft.keyword}</h3>
                  <p className="text-sm text-gray-500">
                    Questions: {draft.questions?.length || 0} • Status: <span className={`font-semibold ${draft.status === 'published' ? 'text-green-600' : 'text-yellow-600'}`}>{draft.status}</span>
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => toggleExpand(draft.id)}
                    className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50"
                  >
                    {expandedId === draft.id ? 'Hide Questions' : 'Preview Questions'}
                  </button>
                  {draft.status === 'draft' ? (
                    <button
                      onClick={() => updateStatus(draft.id, 'published')}
                      className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-200"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      onClick={() => updateStatus(draft.id, 'draft')}
                      className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-200"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === draft.id && (
                <div className="mt-4 max-h-96 overflow-y-auto bg-slate-50 p-4 rounded-xl">
                  {draft.questions?.map((q, idx) => (
                    <div key={idx} className="mb-4 border-b border-slate-200 pb-3 last:border-0">
                      <p className="font-semibold">Q{idx+1}: {q.question}</p>
                      <ul className="ml-4 text-sm">
                        {q.options?.map((opt, oi) => (
                          <li key={oi} className={opt === q.correct_answer ? 'text-green-700 font-bold' : ''}>
                            {opt} {opt === q.correct_answer && '✅'}
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm text-gray-600 mt-1">Difficulty: {q.difficulty}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}