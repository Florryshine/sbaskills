'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { addPoints } from '@/lib/gamification';
import Link from 'next/link';

export default function AwardBonusPoints() {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [points, setPoints] = useState(20);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => { loadStudents(); }, []);

  const loadStudents = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'student')
      .order('full_name', { ascending: true });
    setStudents(data || []);
    setLoading(false);
  };

  const handleAward = async () => {
    if (!selectedStudentId) { alert('Please select a student.'); return; }
    if (!points || points <= 0) { alert('Please enter a positive number of points.'); return; }
    if (!reason) { alert('Please enter a reason — students will see this.'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await addPoints(selectedStudentId, parseInt(points), reason, 'tutor_bonus', user.id);
      alert('✅ Bonus points awarded!');
      setSelectedStudentId('');
      setPoints(20);
      setReason('');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <Link href="/tutor" className="text-sm text-brand-blue underline">← Back to Tutor Dashboard</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">⭐ Award Bonus Points</h1>
        <p className="text-sm text-gray-500">Recognize a student for great work outside quizzes/assignments.</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Student *</label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            disabled={loading}
          >
            <option value="">{loading ? 'Loading students...' : 'Select a student...'}</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Points *</label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Reason * <span className="font-normal text-gray-400">(students will see this)</span></label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="e.g. Excellent participation in class discussion"
          />
        </div>

        <button
          onClick={handleAward}
          disabled={saving}
          className="w-full bg-brand-yellow text-brand-dark py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Awarding...' : '⭐ Award Points'}
        </button>
      </div>
    </div>
  );
}