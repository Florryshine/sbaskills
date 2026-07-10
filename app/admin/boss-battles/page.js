'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
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
    questions_json: '[]',
    required_level: 1,
    required_xp: 0,
    reward_xp: 100,
    reward_coins: 50,
  });
  const [editing, setEditing] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadData() {
      const { data: bossData } = await supabase
        .from('boss_battle_drafts')
        .select('*')
        .order('created_at', { ascending: false });
      setBosses(bossData || []);

      const { data: subjectData } = await supabase
        .from('past_questions')
        .select('subject');
      setSubjects([...new Set((subjectData || []).map(s => s.subject).filter(Boolean))]);

      setLoading(false);
    }
    loadData();
  }, []);

  const handleSave = async () => {
    if (!form.name || !form.subject) {
      alert('Please fill in name and subject.');
      return;
    }

    let questions = [];
    try {
      questions = JSON.parse(form.questions_json);
      if (!Array.isArray(questions)) throw new Error('Must be an array');
    } catch (e) {
      alert('Invalid JSON in questions field. Must be a valid JSON array.');
      return;
    }

    const data = {
      name: form.name,
      keyword: form.name,
      subject: form.subject,
      topic: form.topic,
      difficulty: parseInt(form.difficulty),
      health: parseInt(form.health),
      questions: questions,
      required_level: parseInt(form.required_level),
      required_xp: parseInt(form.required_xp),
      xp_reward: parseInt(form.reward_xp),
      reward_coins: parseInt(form.reward_coins),
    };

    if (editing) {
      const { error } = await supabase
        .from('boss_battle_drafts')
        .update(data)
        .eq('id', editing);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase
        .from('boss_battle_drafts')
        .insert({ ...data, status: 'draft', generated_from: 'manual' })
        .select();
      if (error) { alert(error.message); return; }
    }

    alert('Boss saved!');
    setEditing(null);
    setForm({ name: '', subject: '', topic: '', difficulty: 1, health: 100, questions_json: '[]', required_level: 1, required_xp: 0, reward_xp: 100, reward_coins: 50 });
    const { data: bossData } = await supabase
      .from('boss_battle_drafts')
      .select('*')
      .order('created_at', { ascending: false });
    setBosses(bossData || []);
  };

  const deleteBoss = async (id) => {
    if (!confirm('Delete this boss?')) return;
    await supabase.from('boss_battle_drafts').delete().eq('id', id);
    setBosses(bosses.filter(b => b.id !== id));
  };

  const publishBoss = async (id) => {
    if (!confirm('Publish this boss battle so students can see and play it?')) return;
    setPublishingId(id);
    try {
      const res = await fetch(`/api/boss-battles/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      alert('Published! It should now appear on the student /boss page.');
      const { data: bossData } = await supabase
        .from('boss_battle_drafts')
        .select('*')
        .order('created_at', { ascending: false });
      setBosses(bossData || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setPublishingId(null);
    }
  };

  const editBoss = (boss) => {
    setEditing(boss.id);
    setForm({
      name: boss.name || boss.keyword || '',
      subject: boss.subject || '',
      topic: boss.topic || '',
      difficulty: boss.difficulty || 1,
      health: boss.health || 100,
      questions_json: JSON.stringify(boss.questions || [], null, 2),
      required_level: boss.required_level || 1,
      required_xp: boss.required_xp || 0,
      reward_xp: boss.xp_reward || 100,
      reward_coins: boss.reward_coins || 50,
    });
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border">
        <Link href="/admin/dashboard" className="text-sm text-brand-blue underline">← Back to Admin</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">👹 Boss Battles (Drafts)</h1>
        <p className="text-sm text-gray-500">Manage boss battle drafts. Questions are stored as JSON array.</p>
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
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold mb-1">Questions (JSON array) *</label>
            <textarea
              rows="6"
              value={form.questions_json}
              onChange={e => setForm({...form, questions_json: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 font-mono text-sm"
              placeholder='[{"question":"...","options":["A","B","C","D"],"correct_answer":"A","explanation":"...","difficulty":4}]'
            />
            <p className="text-xs text-gray-400 mt-1">
              Paste the JSON output from the Boss Battle generator, or write your own. Must be a valid array.
            </p>
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
            <button onClick={() => { setEditing(null); setForm({ name: '', subject: '', topic: '', difficulty: 1, health: 100, questions_json: '[]', required_level: 1, required_xp: 0, reward_xp: 100, reward_coins: 50 }); }} className="bg-gray-200 px-6 py-2 rounded-full font-bold">
              Cancel
            </button>
          )}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <p>💡 To auto‑generate questions, use the Boss Battle engine API with a knowledge asset ID. Then copy the JSON from <code>boss_battle_drafts</code>.</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm border overflow-hidden">
        <div className="divide-y divide-slate-100">
          {bosses.map(b => (
            <div key={b.id} className="flex items-center gap-4 p-4 hover:bg-slate-50">
              <div className="flex-1">
                <p className="font-bold">{b.name || b.keyword} <span className="text-xs text-gray-500">({b.subject})</span></p>
                <p className="text-sm text-gray-500">Questions: {b.questions?.length || 0} • XP: {b.xp_reward}</p>
                {b.boss_battle_id && <p className="text-xs text-green-600 font-bold mt-1">✓ Live for students</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => publishBoss(b.id)}
                  disabled={publishingId === b.id}
                  className="text-white bg-brand-blue px-3 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {publishingId === b.id ? 'Publishing...' : b.boss_battle_id ? 'Re-publish' : 'Publish'}
                </button>
                <button onClick={() => editBoss(b)} className="text-blue-600 hover:underline text-sm">Edit</button>
                <button onClick={() => deleteBoss(b.id)} className="text-red-500 hover:underline text-sm">Delete</button>
              </div>
            </div>
          ))}
          {bosses.length === 0 && <div className="p-8 text-center text-gray-500">No boss drafts yet.</div>}
        </div>
      </section>
    </div>
  );
}

// Add this to skip static generation (optional but helps avoid prerender issues)
export const dynamic = 'force-dynamic';