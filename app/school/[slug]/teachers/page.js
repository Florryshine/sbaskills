'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const CLASS_OPTIONS = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];

export default function TeachersPage() {
  const { slug } = useParams();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/school/teachers?school=${slug}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Could not load teachers.');
    } else {
      setTeachers(json.teachers || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  const toggleClass = async (teacher, cls) => {
    const nextClasses = teacher.assigned_classes?.includes(cls)
      ? teacher.assigned_classes.filter(c => c !== cls)
      : [...(teacher.assigned_classes || []), cls];

    setSavingId(teacher.id);
    const res = await fetch('/api/school/teachers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, teacher_id: teacher.id, assigned_classes: nextClasses }),
    });
    if (res.ok) {
      const json = await res.json();
      setTeachers(prev => prev.map(t => (t.id === teacher.id ? json.teacher : t)));
    }
    setSavingId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Module</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Teachers &amp; Principal</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everyone here can only see and manage students at your school. Assign classes so it's clear who's responsible for what.
          </p>
        </div>

        {loading && <p className="text-slate-500">Loading...</p>}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && (
          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-100">
            {teachers.length === 0 && (
              <p className="p-6 text-center text-slate-500">No teachers added to this school yet.</p>
            )}
            {teachers.map(t => (
              <div key={t.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div>
                  <p className="font-bold text-brand-dark">
                    {t.full_name || 'Unnamed'}
                    {t.role === 'principal' && (
                      <span className="ml-2 rounded-full bg-brand-yellow/20 text-brand-blue text-xs font-bold px-2 py-0.5">Principal</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{t.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CLASS_OPTIONS.map(cls => {
                    const active = t.assigned_classes?.includes(cls);
                    return (
                      <button
                        key={cls}
                        disabled={savingId === t.id}
                        onClick={() => toggleClass(t, cls)}
                        className={`text-xs font-bold rounded-full px-3 py-1.5 transition disabled:opacity-50 ${
                          active ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {cls}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
