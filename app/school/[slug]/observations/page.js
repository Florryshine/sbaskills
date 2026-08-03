'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const CLASS_OPTIONS = ['', 'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];

const STATUS_OPTIONS = [
  ['present', 'Present', 'bg-green-100 text-green-700 hover:bg-green-200'],
  ['absent', 'Absent', 'bg-red-100 text-red-700 hover:bg-red-200'],
  ['sick', 'Sick', 'bg-amber-100 text-amber-700 hover:bg-amber-200'],
  ['improving', 'Improving', 'bg-blue-100 text-blue-700 hover:bg-blue-200'],
  ['excellent', 'Excellent', 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'],
  ['needs_attention', 'Needs attention', 'bg-orange-100 text-orange-700 hover:bg-orange-200'],
  ['misbehaving', 'Misbehaving', 'bg-red-100 text-red-700 hover:bg-red-200'],
  ['other', 'Other', 'bg-slate-100 text-slate-600 hover:bg-slate-200'],
];

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map(([v, l]) => [v, l]));
const STATUS_STYLE = {
  present: 'bg-green-100 text-green-700', absent: 'bg-red-100 text-red-700',
  sick: 'bg-amber-100 text-amber-700', improving: 'bg-blue-100 text-blue-700',
  excellent: 'bg-emerald-100 text-emerald-700', needs_attention: 'bg-orange-100 text-orange-700',
  misbehaving: 'bg-red-100 text-red-700', other: 'bg-slate-100 text-slate-600',
};

export default function ObservationsPage() {
  const { slug } = useParams();
  const [classLevel, setClassLevel] = useState('');
  const [students, setStudents] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [openStudent, setOpenStudent] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ school: slug });
    if (classLevel) params.set('class', classLevel);
    const [attRes, obsRes] = await Promise.all([
      fetch(`/api/school/attendance?${params}`),
      fetch(`/api/school/observations?school=${slug}&limit=30`),
    ]);
    const attJson = await attRes.json();
    const obsJson = await obsRes.json();
    if (!attRes.ok) setError(attJson.error || 'Could not load students.');
    else setStudents(attJson.students || []);
    setRecent(obsJson.observations || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug, classLevel]);

  const record = async (studentId, status) => {
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/school/observations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, student_id: studentId, status, note: openStudent === studentId ? note : undefined }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage(`Logged "${STATUS_LABEL[status]}".`);
      setOpenStudent(null);
      setNote('');
      load();
    } else {
      setError(json.error || 'Could not save.');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Module</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Daily Observations</h1>
          <p className="mt-1 text-sm text-slate-500">Tap a status to log how a student is doing today. Add a quick note if you like.</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Class</label>
            <select value={classLevel} onChange={e => setClassLevel(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">All classes</option>
              {CLASS_OPTIONS.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {message && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{message}</div>}
        {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-100">
            {students.length === 0 && <p className="p-6 text-center text-slate-500">No students found.</p>}
            {students.map(s => (
              <div key={s.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-brand-dark">{s.full_name || 'Unnamed Student'}</p>
                    <p className="text-xs text-slate-400">{s.student_level || '—'}</p>
                  </div>
                  <button
                    onClick={() => setOpenStudent(openStudent === s.id ? null : s.id)}
                    className="text-xs font-bold text-brand-blue"
                  >
                    {openStudent === s.id ? 'Close' : 'Log today'}
                  </button>
                </div>
                {openStudent === s.id && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map(([value, label, style]) => (
                        <button
                          key={value}
                          disabled={saving}
                          onClick={() => record(s.id, value)}
                          className={`text-xs font-bold rounded-full px-3 py-2 ${style} disabled:opacity-50`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Optional note (e.g. 'Participated actively in class today')"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recent log across the school */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-100">
          <div className="p-5"><h2 className="font-extrabold text-brand-blue">Recent Observations</h2></div>
          {recent.length === 0 ? (
            <p className="p-6 text-center text-slate-500">No observations logged yet.</p>
          ) : (
            recent.map(o => (
              <div key={o.id} className="p-4 flex items-start gap-3">
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${STATUS_STYLE[o.status] || 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABEL[o.status] || o.status}
                </span>
                <div>
                  <p className="text-sm font-bold text-brand-dark">{o.profiles?.full_name}</p>
                  {o.note && <p className="text-sm text-slate-600">{o.note}</p>}
                  <p className="text-xs text-slate-400">
                    {new Date(o.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} · by {o.teacher?.full_name || 'a teacher'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
