'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';
import QuestionPicker from '@/components/admin/QuestionPicker';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const emptyForm = {
  date: todayStr(),
  subject: '',
  difficulty: 'Medium',
  time_limit_minutes: 10,
  questions: [],
};

export default function AdminDailyChallenge() {
  const [challenges, setChallenges] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [validity, setValidity] = useState({});
  const supabase = createBrowserClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: challengeData, error } = await supabase
      .from('daily_challenges')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error loading daily_challenges:', error);
    }
    setChallenges(challengeData || []);

    const { data: subjectData } = await supabase
      .from('past_questions')
      .select('subject');
    setSubjects([...new Set((subjectData || []).map(s => s.subject).filter(Boolean))]);

    setLoading(false);
    checkValidity(challengeData || []);
  }

  async function checkValidity(list) {
    const allIds = [...new Set(list.flatMap(c => c.questions || []))];
    if (allIds.length === 0) return;
    const { data } = await supabase.from('past_questions').select('id').in('id', allIds);
    const existing = new Set((data || []).map(q => String(q.id)));
    const map = {};
    list.forEach(c => {
      const ids = c.questions || [];
      const missing = ids.filter(id => !existing.has(String(id)));
      map[c.id] = { total: ids.length, missing: missing.length };
    });
    setValidity(map);
  }

  const handleSave = async () => {
    if (!form.date || form.questions.length === 0) {
      alert('Please pick a date and select at least one question.');
      return;
    }

    const data = {
      date: form.date,
      subject: form.subject || null,
      difficulty: form.difficulty,
      time_limit_minutes: parseInt(form.time_limit_minutes) || 10,
      questions: form.questions,
    };

    if (editing) {
      const { error } = await supabase.from('daily_challenges').update(data).eq('id', editing);
      if (error) { alert(error.message); return; }
    } else {
      // date has a natural uniqueness constraint (one challenge per day) —
      // check for an existing challenge on that date first so we don't
      // silently create a duplicate that never gets picked up.
      const { data: existing } = await supabase
        .from('daily_challenges')
        .select('id')
        .eq('date', data.date)
        .maybeSingle();
      if (existing) {
        alert(`A challenge for ${data.date} already exists. Edit that one instead, or pick a different date.`);
        return;
      }
      const { error } = await supabase.from('daily_challenges').insert(data).select();
      if (error) { alert(error.message); return; }
    }

    alert('Daily challenge saved!');
    setEditing(null);
    setForm(emptyForm);
    loadData();
  };

  const deleteChallenge = async (id) => {
    if (!confirm('Delete this challenge?')) return;
    await supabase.from('daily_challenges').delete().eq('id', id);
    setChallenges(challenges.filter(c => c.id !== id));
  };

  const editChallenge = (c) => {
    setEditing(c.id);
    setForm({
      date: c.date,
      subject: c.subject || '',
      difficulty: c.difficulty || 'Medium',
      time_limit_minutes: c.time_limit_minutes || 10,
      questions: c.questions || [],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border">
        <Link href="/admin/dashboard" className="text-sm text-brand-blue underline">← Back to Admin</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">📅 Daily Challenge</h1>
        <p className="text-sm text-gray-500">Set up one challenge per day. Students see it at <code>/challenge</code>.</p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border">
        <h2 className="font-bold text-lg mb-4">{editing ? 'Edit Challenge' : 'Create Challenge'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({...form, date: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Subject label (shown to students)</label>
            <select
              value={form.subject}
              onChange={e => setForm({...form, subject: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            >
              <option value="">Mixed</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Difficulty label</label>
            <select
              value={form.difficulty}
              onChange={e => setForm({...form, difficulty: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Time limit (minutes)</label>
            <input
              type="number" min="1"
              value={form.time_limit_minutes}
              onChange={e => setForm({...form, time_limit_minutes: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-1">Questions *</label>
          <QuestionPicker
            selectedIds={form.questions}
            onChange={(ids) => setForm({...form, questions: ids})}
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={handleSave} className="bg-brand-yellow px-6 py-2 rounded-full font-bold">
            {editing ? 'Update Challenge' : 'Create Challenge'}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(emptyForm); }} className="bg-gray-200 px-6 py-2 rounded-full font-bold">
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm border overflow-hidden">
        <div className="divide-y divide-slate-100">
          {challenges.map(c => {
            const v = validity[c.id];
            const isToday = c.date === todayStr();
            return (
              <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-slate-50">
                <div className="flex-1">
                  <p className="font-bold">
                    {c.date} {isToday && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 ml-1">Today</span>}
                  </p>
                  <p className="text-sm text-gray-500">{c.subject || 'Mixed'} • {c.difficulty} • {c.time_limit_minutes}min • {(c.questions || []).length} question(s)</p>
                  {v && v.missing > 0 && (
                    <p className="text-xs text-red-600 font-semibold mt-1">⚠️ {v.missing} of {v.total} question(s) missing. Edit to fix.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editChallenge(c)} className="text-blue-600 hover:underline text-sm">Edit</button>
                  <button onClick={() => deleteChallenge(c.id)} className="text-red-500 hover:underline text-sm">Delete</button>
                </div>
              </div>
            );
          })}
          {challenges.length === 0 && <div className="p-8 text-center text-gray-500">No daily challenges created yet.</div>}
        </div>
      </section>
    </div>
  );
}