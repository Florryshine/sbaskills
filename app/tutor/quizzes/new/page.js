'use client';
import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function NewQuiz() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(10);
  const [timeLimit, setTimeLimit] = useState(10);
  const [publish, setPublish] = useState(true);
  const [questions, setQuestions] = useState([
    { question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'a' }
  ]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const addQuestion = () => {
    setQuestions([...questions, { question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'a' }]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .insert({ title, description, points_reward: points, time_limit_minutes: timeLimit, is_published: publish, tutor_id: user.id })
      .select().single();

    if (error) { alert('Error: ' + error.message); setSaving(false); return; }

    for (let i = 0; i < questions.length; i++) {
      await supabase.from('quiz_questions').insert({ ...questions[i], quiz_id: quiz.id, order_index: i });
    }

    alert('Quiz created successfully!');
    router.push('/tutor');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold text-brand-blue mb-6">Create New Quiz</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">Quiz Title *</label>
              <input required value={title} onChange={e => setTitle(e.target.value)}
                className="w-full border rounded-xl px-4 py-2" placeholder="e.g. JAMB Biology Quiz" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                className="w-full border rounded-xl px-4 py-2" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1">Points Reward</label>
                <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))}
                  className="w-full border rounded-xl px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Time Limit (minutes)</label>
                <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                  className="w-full border rounded-xl px-4 py-2" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} />
              <span className="text-sm font-bold">Publish immediately</span>
            </label>
          </div>

          {questions.map((q, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border space-y-3">
              <h3 className="font-bold text-gray-700">Question {i + 1}</h3>
              <input required value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)}
                placeholder="Enter question" className="w-full border rounded-xl px-4 py-2" />
              {['a','b','c','d'].map(opt => (
                <input key={opt} required value={q[`option_${opt}`]}
                  onChange={e => updateQuestion(i, `option_${opt}`, e.target.value)}
                  placeholder={`Option ${opt.toUpperCase()}`} className="w-full border rounded-xl px-4 py-2" />
              ))}
              <div>
                <label className="block text-sm font-bold mb-1">Correct Answer</label>
                <select value={q.correct_answer} onChange={e => updateQuestion(i, 'correct_answer', e.target.value)}
                  className="w-full border rounded-xl px-4 py-2">
                  {['a','b','c','d'].map(opt => (
                    <option key={opt} value={opt}>Option {opt.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          <button type="button" onClick={addQuestion}
            className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-3 text-gray-500 font-bold hover:border-brand-blue hover:text-brand-blue transition">
            + Add Question
          </button>

          <button type="submit" disabled={saving}
            className="w-full bg-brand-yellow text-brand-dark font-bold py-3 rounded-full hover:opacity-90 disabled:opacity-50">
            {saving ? 'Creating Quiz...' : 'Create Quiz'}
          </button>
        </form>
      </div>
    </div>
  );
}