'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewAssignment() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    subject: '',
    due_date: '',
    max_score: 100,
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleSave = async () => {
    if (!form.title) {
      alert('Please enter an assignment title.');
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('assignments').insert({
      tutor_id: user.id,
      title: form.title,
      description: form.description,
      subject: form.subject || null,
      due_date: form.due_date || null,
      max_score: parseInt(form.max_score) || 100,
    });

    setSaving(false);

    if (error) {
      alert('Error creating assignment: ' + error.message);
      return;
    }

    alert('✅ Assignment created!');
    router.push('/tutor');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <Link href="/tutor" className="text-sm text-brand-blue underline">← Back to Tutor Dashboard</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">📄 Create Assignment</h1>
        <p className="text-sm text-gray-500">Students will see this assignment and can submit their work against it.</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="e.g. Chemistry: Periodic Table Worksheet"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 h-32"
            placeholder="What should students do for this assignment?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
              placeholder="e.g. Chemistry"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Max Score</label>
            <input
              type="number"
              value={form.max_score}
              onChange={(e) => setForm({ ...form, max_score: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand-blue text-white py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Assignment'}
        </button>
      </div>
    </div>
  );
}