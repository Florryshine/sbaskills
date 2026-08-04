'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const CLASS_OPTIONS = ['', 'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
const STATUS_CYCLE = { present: 'late', late: 'absent', absent: 'present' };
const STATUS_STYLE = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-amber-100 text-amber-700',
  absent: 'bg-red-100 text-red-700',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { slug } = useParams();
  const [date, setDate] = useState(todayStr());
  const [classLevel, setClassLevel] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ school: slug, date });
    if (classLevel) params.set('class', classLevel);
    const res = await fetch(`/api/school/attendance?${params}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Could not load attendance.');
    } else {
      setStudents(json.students || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug, date, classLevel]);

  const cycleStatus = (studentId) => {
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const next = s.status ? STATUS_CYCLE[s.status] : 'present';
      return { ...s, status: next };
    }));
    setSavedMessage('');
  };

  const markAll = (status) => {
    setStudents(prev => prev.map(s => ({ ...s, status })));
    setSavedMessage('');
  };

  const save = async () => {
    setSaving(true);
    setSavedMessage('');
    const records = students
      .filter(s => s.status)
      .map(s => ({ student_id: s.id, status: s.status, class_level: s.student_level }));

    const res = await fetch('/api/school/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, date, records }),
    });
    const json = await res.json();
    if (res.ok) {
      setSavedMessage(`Saved attendance for ${json.saved} student(s).`);
    } else {
      setError(json.error || 'Could not save attendance.');
    }
    setSaving(false);
  };

  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.filter(s => s.status === 'absent').length;
  const lateCount = students.filter(s => s.status === 'late').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Module</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Tap a student to cycle present → late → absent, then save.</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Class</label>
            <select
              value={classLevel}
              onChange={e => setClassLevel(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All classes</option>
              {CLASS_OPTIONS.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => markAll('present')} className="text-xs font-bold rounded-full px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200">Mark all present</button>
            <button onClick={() => markAll('absent')} className="text-xs font-bold rounded-full px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200">Mark all absent</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white p-4 text-center border border-slate-100"><p className="text-xl font-extrabold text-green-600">{presentCount}</p><p className="text-xs text-slate-500">Present</p></div>
          <div className="rounded-xl bg-white p-4 text-center border border-slate-100"><p className="text-xl font-extrabold text-amber-600">{lateCount}</p><p className="text-xs text-slate-500">Late</p></div>
          <div className="rounded-xl bg-white p-4 text-center border border-slate-100"><p className="text-xl font-extrabold text-red-600">{absentCount}</p><p className="text-xs text-slate-500">Absent</p></div>
        </div>

        {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-100">
            {students.length === 0 && <p className="p-6 text-center text-slate-500">No students found for this class.</p>}
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => cycleStatus(s.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-left"
              >
                <div>
                  <p className="font-bold text-brand-dark">{s.full_name || 'Unnamed Student'}</p>
                  <p className="text-xs text-slate-400">{s.student_level || '—'}</p>
                </div>
                <span className={`text-xs font-bold rounded-full px-3 py-1.5 ${s.status ? STATUS_STYLE[s.status] : 'bg-slate-100 text-slate-400'}`}>
                  {s.status || 'Not marked'}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={saving || students.length === 0}
            className="rounded-full bg-brand-blue text-white font-bold px-6 py-3 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
          {savedMessage && <p className="text-sm text-green-600 font-semibold">{savedMessage}</p>}
        </div>
      </div>
    </div>
  );
}
