'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

/**
 * QuestionPicker
 * Lets an admin search past_questions by subject/topic/keyword and build
 * an ordered list of selected question IDs — instead of typing raw IDs
 * by hand. Also verifies that any pre-existing selectedIds still exist
 * in past_questions (they can go stale after a quiz draft is republished,
 * since republishing deletes and re-inserts those rows with new IDs).
 *
 * Props:
 *  - selectedIds: string[]  (current question IDs, in order)
 *  - onChange: (newIds: string[]) => void
 */
export default function QuestionPicker({ selectedIds = [], onChange }) {
  const supabase = createBrowserClient();
  const [subjects, setSubjects] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState([]); // full rows, in order
  const [missingIds, setMissingIds] = useState([]);
  const [checkedStale, setCheckedStale] = useState(false);

  // Load subject list for the filter dropdown
  useEffect(() => {
    async function loadSubjects() {
      const { data } = await supabase.from('past_questions').select('subject');
      setSubjects([...new Set((data || []).map(s => s.subject).filter(Boolean))]);
    }
    loadSubjects();
  }, []);

  // Resolve the incoming selectedIds (strings from the parent) into full
  // question rows so we can show a preview, and flag any that no longer exist.
  useEffect(() => {
    async function resolveSelected() {
      setCheckedStale(false);
      if (!selectedIds || selectedIds.length === 0) {
        setSelectedQuestions([]);
        setMissingIds([]);
        setCheckedStale(true);
        return;
      }
      const { data } = await supabase
        .from('past_questions')
        .select('*')
        .in('id', selectedIds);

      const found = data || [];
      const foundIds = found.map(q => String(q.id));
      const missing = selectedIds.filter(id => !foundIds.includes(String(id)));

      // Preserve original order
      const ordered = selectedIds
        .map(id => found.find(q => String(q.id) === String(id)))
        .filter(Boolean);

      setSelectedQuestions(ordered);
      setMissingIds(missing);
      setCheckedStale(true);
    }
    resolveSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds?.join(',')]);

  const runSearch = async () => {
    setLoading(true);
    let query = supabase.from('past_questions').select('*').limit(50);
    if (subjectFilter) query = query.eq('subject', subjectFilter);
    if (search.trim()) query = query.ilike('question', `%${search.trim()}%`);
    const { data, error } = await query.order('id', { ascending: false });
    if (error) {
      alert('Search error: ' + error.message);
      setLoading(false);
      return;
    }
    setResults(data || []);
    setLoading(false);
  };

  const addQuestion = (q) => {
    if (selectedQuestions.some(sq => String(sq.id) === String(q.id))) return;
    const next = [...selectedQuestions, q];
    setSelectedQuestions(next);
    onChange(next.map(sq => sq.id));
  };

  const removeQuestion = (id) => {
    const next = selectedQuestions.filter(sq => String(sq.id) !== String(id));
    setSelectedQuestions(next);
    onChange(next.map(sq => sq.id));
    setMissingIds(missingIds.filter(mid => String(mid) !== String(id)));
  };

  const clearAllMissing = () => {
    onChange(selectedQuestions.map(sq => sq.id));
    setMissingIds([]);
  };

  return (
    <div className="space-y-4">
      {/* Stale ID warning */}
      {checkedStale && missingIds.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-bold">⚠️ {missingIds.length} selected question ID(s) no longer exist in past_questions.</p>
          <p className="mt-1">This usually happens when a quiz draft they came from was re-published, which regenerates
            question IDs. Remove and re-add fresh questions below, or click to drop the missing ones.</p>
          <button type="button" onClick={clearAllMissing} className="mt-2 rounded-full bg-red-600 text-white px-3 py-1 text-xs font-bold">
            Remove missing IDs
          </button>
        </div>
      )}

      {/* Selected list */}
      <div>
        <p className="text-sm font-semibold mb-2">Selected questions ({selectedQuestions.length})</p>
        {selectedQuestions.length === 0 ? (
          <p className="text-sm text-gray-400 border border-dashed rounded-xl p-4 text-center">No questions selected yet. Search below to add some.</p>
        ) : (
          <ul className="space-y-2 max-h-56 overflow-y-auto">
            {selectedQuestions.map((q, i) => (
              <li key={q.id} className="flex items-start gap-2 rounded-xl border border-slate-200 p-2 text-sm">
                <span className="text-gray-400 font-mono">{i + 1}.</span>
                <span className="flex-1">{q.question}</span>
                <button type="button" onClick={() => removeQuestion(q.id)} className="text-red-500 hover:underline shrink-0">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Search */}
      <div className="rounded-xl border border-slate-200 p-3 space-y-2">
        <div className="flex gap-2">
          <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), runSearch())}
            placeholder="Search question text..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button type="button" onClick={runSearch} className="rounded-lg bg-brand-blue text-white px-4 py-2 text-sm font-bold">
            {loading ? '...' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {results.map(q => {
              const already = selectedQuestions.some(sq => String(sq.id) === String(q.id));
              return (
                <li key={q.id} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-slate-50">
                  <span className="flex-1">
                    {q.question}
                    <span className="block text-xs text-gray-400">{q.subject} • {q.topic || 'General'} {q.year ? `• ${q.year}` : ''}</span>
                  </span>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => addQuestion(q)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${already ? 'bg-gray-100 text-gray-400' : 'bg-brand-yellow text-brand-dark hover:opacity-90'}`}
                  >
                    {already ? 'Added' : 'Add'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}