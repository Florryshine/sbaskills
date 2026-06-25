'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewQuiz() {
  const [quiz, setQuiz] = useState({
    title: '',
    description: '',
    points_reward: 10,
    time_limit_minutes: 10,
    is_published: false,
  });
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'a',
    points: 1,
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const addQuestion = () => {
    if (!currentQuestion.question) {
      alert('Please enter a question');
      return;
    }
    if (!currentQuestion.option_a || !currentQuestion.option_b || !currentQuestion.option_c || !currentQuestion.option_d) {
      alert('Please enter all options');
      return;
    }
    setQuestions([...questions, { ...currentQuestion, order_index: questions.length }]);
    setCurrentQuestion({
      question: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'a',
      points: 1,
    });
  };

  const removeQuestion = (index) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions.map((q, i) => ({ ...q, order_index: i })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quiz.title) { alert('Please enter a quiz title'); return; }
    if (questions.length === 0) { alert('Please add at least one question'); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Create quiz
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        title: quiz.title,
        description: quiz.description,
        points_reward: quiz.points_reward,
        time_limit_minutes: quiz.time_limit_minutes,
        is_published: quiz.is_published,
        tutor_id: user.id,
      })
      .select()
      .single();

    if (quizError) {
      alert('Error creating quiz: ' + quizError.message);
      setSaving(false);
      return;
    }

    // Create questions
    const questionsWithQuiz = questions.map(q => ({
      ...q,
      quiz_id: quizData.id,
    }));

    const { error: questionsError } = await supabase
      .from('quiz_questions')
      .insert(questionsWithQuiz);

    if (questionsError) {
      alert('Error adding questions: ' + questionsError.message);
    } else {
      alert('✅ Quiz created successfully!');
      router.push('/tutor');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <Link href="/tutor" className="text-sm text-brand-blue underline">← Back to Dashboard</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">Create New Quiz</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl p-6 shadow-sm border">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold mb-1">Quiz Title *</label>
            <input
              type="text"
              required
              value={quiz.title}
              onChange={e => setQuiz({ ...quiz, title: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold mb-1">Description</label>
            <textarea
              rows="2"
              value={quiz.description}
              onChange={e => setQuiz({ ...quiz, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Points Reward</label>
            <input
              type="number"
              value={quiz.points_reward}
              onChange={e => setQuiz({ ...quiz, points_reward: parseInt(e.target.value) || 10 })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Time Limit (minutes)</label>
            <input
              type="number"
              value={quiz.time_limit_minutes}
              onChange={e => setQuiz({ ...quiz, time_limit_minutes: parseInt(e.target.value) || 10 })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={quiz.is_published}
              onChange={e => setQuiz({ ...quiz, is_published: e.target.checked })}
              className="w-5 h-5"
            />
            <label className="text-sm font-semibold">Publish immediately (visible to students)</label>
          </div>
        </div>

        {/* Questions Section */}
        <div className="border-t pt-6">
          <h2 className="text-lg font-bold mb-4">Questions ({questions.length})</h2>

          {/* Add Question Form */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <h3 className="font-semibold mb-3">Add Question</h3>
            <div className="grid gap-3">
              <input
                type="text"
                placeholder="Question text"
                value={currentQuestion.question}
                onChange={e => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Option A"
                  value={currentQuestion.option_a}
                  onChange={e => setCurrentQuestion({ ...currentQuestion, option_a: e.target.value })}
                  className="rounded-xl border border-slate-200 px-4 py-2"
                />
                <input
                  type="text"
                  placeholder="Option B"
                  value={currentQuestion.option_b}
                  onChange={e => setCurrentQuestion({ ...currentQuestion, option_b: e.target.value })}
                  className="rounded-xl border border-slate-200 px-4 py-2"
                />
                <input
                  type="text"
                  placeholder="Option C"
                  value={currentQuestion.option_c}
                  onChange={e => setCurrentQuestion({ ...currentQuestion, option_c: e.target.value })}
                  className="rounded-xl border border-slate-200 px-4 py-2"
                />
                <input
                  type="text"
                  placeholder="Option D"
                  value={currentQuestion.option_d}
                  onChange={e => setCurrentQuestion({ ...currentQuestion, option_d: e.target.value })}
                  className="rounded-xl border border-slate-200 px-4 py-2"
                />
              </div>
              <div className="flex gap-4 items-center">
                <label className="text-sm font-semibold">Correct Answer:</label>
                <select
                  value={currentQuestion.correct_answer}
                  onChange={e => setCurrentQuestion({ ...currentQuestion, correct_answer: e.target.value })}
                  className="rounded-xl border border-slate-200 px-4 py-2"
                >
                  <option value="a">A</option>
                  <option value="b">B</option>
                  <option value="c">C</option>
                  <option value="d">D</option>
                </select>
                <label className="text-sm font-semibold ml-4">Points:</label>
                <input
                  type="number"
                  value={currentQuestion.points}
                  onChange={e => setCurrentQuestion({ ...currentQuestion, points: parseInt(e.target.value) || 1 })}
                  className="w-20 rounded-xl border border-slate-200 px-2 py-2"
                />
                <button
                  type="button"
                  onClick={addQuestion}
                  className="bg-brand-blue text-white px-4 py-2 rounded-full text-sm font-bold hover:opacity-90"
                >
                  + Add Question
                </button>
              </div>
            </div>
          </div>

          {/* Question List */}
          {questions.length > 0 && (
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={i} className="flex items-center justify-between bg-white border rounded-xl p-3">
                  <div>
                    <p className="font-semibold text-sm">{i + 1}. {q.question}</p>
                    <p className="text-xs text-gray-500">A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}</p>
                    <p className="text-xs text-green-600">Correct: {q.correct_answer.toUpperCase()} | Points: {q.points}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand-yellow px-6 py-3 font-bold text-brand-dark hover:opacity-90"
        >
          {saving ? 'Creating...' : 'Create Quiz'}
        </button>
      </form>
    </div>
  );
}