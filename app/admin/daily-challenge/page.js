'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminBossBattles() {
  const [bosses, setBosses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    subject: '',
    topic: '',
    difficulty: 1,
    health: 100,
    questions: '',
    required_level: 1,
    required_xp: 0,
    reward_xp: 100,
    reward_coins: 50,
  });
  const [editing, setEditing] = useState(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadData() {
      const { data: bossData } = await supabase
        .from('boss_battles')
        .select('*')
        .order('difficulty', { ascending: true });

      setBosses(bossData || []);

      const { data: subjectData } = await supabase
        .from('past_questions')
        .select('subject')
        .distinct();
      setSubjects(subjectData?.map(s => s.subject).filter(Boolean) || []);

      setLoading(false);
    }
    loadData();
  }, []);

  const handleSave = async () => {
    if (!form.name || !form.subject || !form.questions) {
      alert('Please fill in name, subject, and question IDs.');
      return;
    }

    const questionIds = form.questions.split(',').map(id => id.trim()).filter(Boolean);
    if (questionIds.length === 0) {
      alert('Please enter at least one question ID.');
      return;
    }

    const data = {
      name: form.name,
      subject: form.subject,
      topic: form.topic,
      difficulty: parseInt(form.difficulty),
      health: parseInt(form.health),
      questions: questionIds,
      required_level: parseInt(form.required_level),
      required_xp: parseInt(form.required_xp),
      reward_xp: parseInt(form.reward_xp),
      reward_coins: parseInt(form.reward_coins),
    };

    if (editing) {
      const { error } = await supabase
        .from('boss_battles')
        .update(data)
        .eq('id', editing);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase
        .from('boss_battles')
        .insert(data)
        .select();
      if (error) { alert(error.message); return; }
    }

    alert('Boss saved!');
    setEditing(null);
    setForm({ name: '', subject: '', topic: '', difficulty: 1, health: 100, questions: '', required_level: 1, required_xp: 0, reward_xp: 100, reward_coins: 50 });
    const { data: bossData } = await supabase
      .from('boss_battles')
      .select('*')
      .order('difficulty', { ascending: true });
    setBosses(bossData || []);
  };

  const deleteBoss = async (id) => {
    if (!confirm('Delete this boss?')) return;
    await supabase.from('boss_battles').delete().eq('id', id);
    setBosses(bosses.filter(b => b.id !== id));
  };

  const editBoss = (boss) => {
    setEditing(boss.id);
    setForm({
      name: boss.name,
      subject: boss.subject,
      topic: boss.topic || '',
      difficulty: boss.difficulty,
      health: boss.health,
      questions: (boss.questions || []).join(', '),
      required_level: boss.required_level,
      required_xp: boss.required_xp,
      reward_xp: boss.reward_xp,
      reward_coins: boss.reward_coins,
    });
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border">
        <Link href="/admin/dashboard" className="text-sm text-brand-blue underline">← Back to Admin</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">👹 Boss Battles</h1>
        <p className="text-sm text-gray-500">Manage bosses for students to defeat.</p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border">
        <h2 className="font-bold text-lg mb-4">{editing ? 'Edit Boss' : 'Create Boss'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Subject *</label>
            <select
              value={form.subject}
              onChange={e => setForm({...form, subject: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            >
              <option value="">Select subject</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Topic</label>
            <input
              type="text"
              value={form.topic}
              onChange={e => setForm({...form, topic: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Difficulty (1-5)</label>
            <input
              type="number" min="1" max="5"
              value={form.difficulty}
              onChange={e => setForm({...form, difficulty: parseInt(e.target.value)})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Health (HP)</label>
            <input
              type="number" min="20"
              value={form.health}
              onChange={e => setForm({...form, health: parseInt(e.target.value)})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Question IDs (comma separated) *</label>
            <input
              type="text"
              value={form.questions}
              onChange={e => setForm({...form, questions: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
              placeholder="e.g. 123,456,789"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Required Level</label>
            <input
              type="number"
              value={form.required_level}
              onChange={e => setForm({...form, required_level: parseInt(e.target.value)})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Required XP</label>
            <input
              type="number"
              value={form.required_xp}
              onChange={e => setForm({...form, required_xp: parseInt(e.target.value)})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Reward XP</label>
            <input
              type="number"
              value={form.reward_xp}
              onChange={e => setForm({...form, reward_xp: parseInt(e.target.value)})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Reward Coins</label>
            <input
              type="number"
              value={form.reward_coins}
              onChange={e => setForm({...form, reward_coins: parseInt(e.target.value)})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={handleSave} className="bg-brand-yellow px-6 py-2 rounded-full font-bold">
            {editing ? 'Update Boss' : 'Create Boss'}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm({ name: '', subject: '', topic: '', difficulty: 1, health: 100, questions: '', required_level: 1, required_xp: 0, reward_xp: 100, reward_coins: 50 }); }} className="bg-gray-200 px-6 py-2 rounded-full font-bold">
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm border overflow-hidden">
        <div className="divide-y divide-slate-100">
          {bosses.map(b => (
            <div key={b.id} className="flex items-center gap-4 p-4 hover:bg-slate-50">
              <div className="flex-1">
                <p className="font-bold">{b.name} <span className="text-xs text-gray-500">({b.subject})</span></p>
                <p className="text-sm text-gray-500">HP: {b.health} • Difficulty: {b.difficulty} • XP: {b.reward_xp}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editBoss(b)} className="text-blue-600 hover:underline text-sm">Edit</button>
                <button onClick={() => deleteBoss(b.id)} className="text-red-500 hover:underline text-sm">Delete</button>
              </div>
            </div>
          ))}
          {bosses.length === 0 && <div className="p-8 text-center text-gray-500">No bosses created yet.</div>}
        </div>
      </section>
    </div>
  );
}