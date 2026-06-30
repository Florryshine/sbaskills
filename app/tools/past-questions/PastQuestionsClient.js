'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function PastQuestionsClient() {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [years, setYears] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [showAnswer, setShowAnswer] = useState({});
  const [totalCount, setTotalCount] = useState(0);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchFilters() {
      const { data: subjectData } = await supabase
        .from('past_questions')
        .select('subject');
      if (subjectData) setSubjects([...new Set(subjectData.map(s => s.subject).filter(Boolean))]);

      const { data: yearData } = await supabase
        .from('past_questions')
        .select('year')
        .order('year', { ascending: false });
      if (yearData) setYears([...new Set(yearData.map(y => y.year).filter(Boolean))]);

      const { data: examData } = await supabase
        .from('past_questions')
        .select('exam_type');
      if (examData) setExamTypes([...new Set(examData.map(e => e.exam_type).filter(Boolean))]);
    }
    fetchFilters();
  }, []);

  const searchQuestions = async () => {
    setLoading(true);
    let query = supabase.from('past_questions').select('*');

    if (searchTerm.trim()) {
      query = query.textSearch('question', searchTerm.trim(), { config: 'english' });
    }

    if (selectedSubject) query = query.eq('subject', selectedSubject);
    if (selectedYear) query = query.eq('year', parseInt(selectedYear));
    if (selectedExamType) query = query.eq('exam_type', selectedExamType);

    const { data, error } = await query
      .order('year', { ascending: false })
      .limit(100);

    if (error) {
      alert('Error searching: ' + error.message);
      setLoading(false);
      return;
    }

    setQuestions(data || []);
    setTotalCount(data?.length || 0);
    setShowAnswer({});
    setLoading(false);
  };

  const toggleAnswer = (id) => {
    setShowAnswer(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedSubject('');
    setSelectedYear('');
    setSelectedExamType('');
    setQuestions([]);
    setTotalCount(0);
    setShowAnswer({});
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h1 className="text-3xl font-extrabold text-brand-blue mb-2">📝 Past Question Search</h1>
        <p className="text-gray-600 mb-6">Search for past questions by keyword, subject, year, or exam type.</p>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2"
            />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2"
            >
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={selectedExamType}
              onChange={(e) => setSelectedExamType(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2"
            >
              <option value="">All Exams</option>
              {examTypes.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={searchQuestions}
              disabled={loading}
              className="bg-brand-yellow text-brand-dark px-6 py-2 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={resetFilters}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-full font-bold hover:bg-gray-300"
            >
              Reset
            </button>
          </div>
        </div>

        {loading && <div className="mt-8 text-center py-12 text-gray-500">Searching...</div>}

        {!loading && questions.length === 0 && (searchTerm || selectedSubject || selectedYear || selectedExamType) && (
          <div className="mt-8 text-center py-12"><p className="text-4xl mb-4">🔍</p><p className="text-gray-500">No questions found.</p></div>
        )}

        {!loading && questions.length > 0 && (
          <div className="mt-8">
            <p className="text-sm text-gray-500 mb-4">Found {totalCount} questions</p>
            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={q.id} className="border rounded-xl p-4 hover:shadow-sm transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 text-xs mb-2">
                        <span className="bg-brand-blue/10 text-brand-blue px-2 py-1 rounded-full">{q.subject || 'General'}</span>
                        {q.exam_type && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">{q.exam_type}</span>}
                        {q.year && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{q.year}</span>}
                        {q.topic && <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{q.topic}</span>}
                      </div>
                      <p className="font-medium text-gray-800">{q.question}</p>
                      {q.option_a && (
                        <div className="mt-2 grid grid-cols-2 gap-1 text-sm text-gray-600">
                          <div>A. {q.option_a}</div>
                          <div>B. {q.option_b}</div>
                          <div>C. {q.option_c}</div>
                          <div>D. {q.option_d}</div>
                        </div>
                      )}
                      <button
                        onClick={() => toggleAnswer(q.id)}
                        className="mt-3 text-brand-blue text-sm font-semibold hover:underline"
                      >
                        {showAnswer[q.id] ? 'Hide Answer' : 'Show Answer'}
                      </button>
                      {showAnswer[q.id] && (
                        <div className="mt-2 bg-green-50 rounded-xl p-3 border border-green-200">
                          <p className="text-sm font-bold text-green-700">✅ Correct Answer: {q.correct_answer?.toUpperCase()}</p>
                          {q.explanation && <p className="text-sm text-gray-700 mt-1">💡 {q.explanation}</p>}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-400 whitespace-nowrap ml-4">#{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}