'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewAssignment() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    points_reward: 20,
    due_date: '',
    is_published: false,
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description) {
      alert('Title and description are required');
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('assignments')
      .insert({
        title: form.title,
        description: form.description,
        points_reward: form.points_reward,
        due_date: form.due_date || null,
        is_published: form.is_published,
        tutor_id: user.id,
      })
      .select()
      .single();

    if (error) {
      alert('Error creating assignment: ' + error.message);
    } else {
      alert('✅ Assignment created successfully!');
      router.push('/tutor');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <Link href="/tutor" className="text-sm text-brand-blue underline">← Back to Dashboard</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">Create New Assignment</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl p-6 shadow-sm border">
        <div>
          <label className="block text-sm font-semibold mb-1">Assignment Title *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Description *</label>
          <textarea
            rows="5"
            required
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold mb-1">Points Reward</label>
            <input
              type="number"
              value={form.points_reward}
              onChange={e => setForm({ ...form, points_reward: parseInt(e.target.value) || 20 })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Due Date</label>
            <input
              type="datetime-local"
              value={form.due_date}
              onChange={e => setForm({ ...form, due_date: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={e => setForm({ ...form, is_published: e.target.checked })}
            className="w-5 h-5"
          />
          <label className="text-sm font-semibold">Publish immediately</label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand-yellow px-6 py-3 font-bold text-brand-dark hover:opacity-90"
        >
          {saving ? 'Creating...' : 'Create Assignment'}
        </button>
      </form>
    </div>
  );
}