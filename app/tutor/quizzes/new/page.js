'use client';

import { useState, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewQuiz() {
  const [quiz, setQuiz] = useState({
    title: '',
    description: '',
    points_reward: 10,
    time_limit_minutes: 10,
    is_published: true,
  });
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'a',
    explanation: '',
    points: 1,
  });
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const fileInputRef = useRef(null);
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
      explanation: '',
      points: 1,
    });
  };

  const removeQuestion = (index) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions.map((q, i) => ({ ...q, order_index: i })));
  };

  // ---------- Bulk upload parser ----------
  const parseBulkText = (text) => {
    const lines = text.split('\n');
    const parsed = [];
    let current = null;
    let questionLines = [];

    const flushQuestion = () => {
      if (!current) return;
      current.question = questionLines.join(' ').trim();
      if (current.question) {
        parsed.push({ ...current });
      }
      current = null;
      questionLines = [];
    };

    for (let line of lines) {
      line = line.trim();
      if (!line) {
        if (current) flushQuestion();
        continue;
      }

      if (/^Question:/i.test(line) || /^Q\d+[:.]/i.test(line)) {
        if (current) flushQuestion();
        current = {
          question: '',
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_answer: 'a',
          explanation: '',
          points: 1,
        };
        const qText = line.replace(/^Question:\s*/i, '').replace(/^Q\d+[:.]\s*/, '');
        questionLines = [qText];
        continue;
      }

      if (current) {
        const optionMatch = line.match(/^([A-D])\s*[).]\s*(.+)/i);
        if (optionMatch) {
          const letter = optionMatch[1].toLowerCase();
          const text = optionMatch[2].trim();
          if (letter === 'a') current.option_a = text;
          else if (letter === 'b') current.option_b = text;
          else if (letter === 'c') current.option_c = text;
          else if (letter === 'd') current.option_d = text;
          continue;
        }

        const answerMatch = line.match(/^Answer:\s*([A-D])/i);
        if (answerMatch) {
          current.correct_answer = answerMatch[1].toLowerCase();
          continue;
        }

        const explMatch = line.match(/^Explanation:\s*(.*)/i);
        if (explMatch) {
          current.explanation = explMatch[1].trim();
          continue;
        }

        questionLines.push(line);
      }
    }

    if (current) flushQuestion();
    return parsed;
  };

  const rowsToQuestions = (rows) => rows.map((row) => ({
    question: String(row.question ?? row.Question ?? row.Q ?? '').trim(),
    option_a: String(row.option_a ?? row.A ?? row.OptionA ?? row['Option A'] ?? '').trim(),
    option_b: String(row.option_b ?? row.B ?? row.OptionB ?? row['Option B'] ?? '').trim(),
    option_c: String(row.option_c ?? row.C ?? row.OptionC ?? row['Option C'] ?? '').trim(),
    option_d: String(row.option_d ?? row.D ?? row.OptionD ?? row['Option D'] ?? '').trim(),
    correct_answer: String(row.correct_answer ?? row.Answer ?? row.answer ?? 'a').trim().toLowerCase().replace(/[^a-d]/g, '').slice(0, 1) || 'a',
    explanation: String(row.explanation ?? row.Explanation ?? '').trim(),
    points: Number(row.points ?? 1) || 1,
  })).filter(q => q.question && q.option_a && q.option_b && q.option_c && q.option_d);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let parsed = [];
      const ext = file.name.split('.').pop().toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        parsed = rowsToQuestions(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth/mammoth.browser');
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        parsed = parseBulkText(result.value);
      } else if (ext === 'txt') {
        parsed = parseBulkText(await file.text());
      } else {
        alert('Supported formats: TXT, CSV, Excel (.xlsx/.xls), and Word (.docx).');
        return;
      }
      if (parsed.length === 0) {
        alert('No valid questions found. For CSV/Excel use headers: question, option_a, option_b, option_c, option_d, correct_answer, explanation. For TXT/Word use the displayed Question/Options/Answer/Explanation format.');
        return;
      }
      const newQuestions = parsed.map((q, idx) => ({ ...q, order_index: questions.length + idx }));
      setQuestions(prev => [...prev, ...newQuestions]);
      setShowBulk(false);
      alert(`✅ Added ${parsed.length} questions successfully!`);
    } catch (error) {
      console.error('Quiz file import failed:', error);
      alert('Could not read this file. Please check that it is a valid supported file.');
    } finally {
      e.target.value = '';
    }
  };

  // ---------- Save quiz ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quiz.title) { alert('Please enter a quiz title'); return; }
    if (questions.length === 0) { alert('Please add at least one question'); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Questions ({questions.length})</h2>
            <button
              type="button"
              onClick={() => setShowBulk(!showBulk)}
              className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:opacity-90"
            >
              📤 Bulk Upload
            </button>
          </div>

          {/* Bulk upload area */}
          {showBulk && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold mb-2">Upload quiz questions</p>
              <p className="text-xs text-gray-500 mb-3">
                Supported: TXT, CSV, Excel (.xlsx/.xls), Word (.docx). TXT/Word: Question:, A), B), C), D), Answer:, Explanation:. CSV/Excel headers: question, option_a, option_b, option_c, option_d, correct_answer, explanation.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".txt,.csv,.xlsx,.xls,.docx"
                  onChange={handleFileUpload}
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    alert(
`Example format:
Question: What is the powerhouse of the cell?
A) Nucleus
B) Ribosome
C) Mitochondria
D) Golgi
Answer: C
Explanation: Mitochondria are known as the powerhouse of the cell.

Question: Which organelle contains DNA?
A) Mitochondria
B) Nucleus
C) Ribosome
D) Lysosome
Answer: B`
                    );
                  }}
                  className="text-xs text-brand-blue underline"
                >
                  Show example
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowBulk(false)}
                className="mt-3 text-xs text-red-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}

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
              <textarea
                placeholder="Explanation (optional; shown after submission)"
                value={currentQuestion.explanation}
                onChange={e => setCurrentQuestion({ ...currentQuestion, explanation: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-4 py-2"
              />
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
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {questions.map((q, i) => (
                <div key={i} className="flex items-center justify-between bg-white border rounded-xl p-3">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{i + 1}. {q.question}</p>
                    <p className="text-xs text-gray-500">A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}</p>
                    <p className="text-xs text-green-600">Correct: {q.correct_answer.toUpperCase()} | Points: {q.points}</p>
                    {q.explanation && <p className="text-xs text-gray-600 mt-1">Explanation: {q.explanation}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    className="text-red-500 hover:text-red-700 text-sm ml-4"
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