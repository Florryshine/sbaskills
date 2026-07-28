'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const DEFAULT_SESSION = '2025/2026';
const DEFAULT_TERM = 'First Term';
const DEFAULT_SUBJECTS = ['Mathematics', 'English Language', 'Biology'];

function emptyScores() {
  return DEFAULT_SUBJECTS.map(subject => ({ subject, score: '', grade: '', remark: '' }));
}

export default function ReportCardsPage() {
  const { slug } = useParams();
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [session, setSession] = useState(DEFAULT_SESSION);
  const [reportCards, setReportCards] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    student_id: '', class_level: '', subject_scores: emptyScores(),
    teacher_comment: '', position_in_class: '', class_size: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    const [rcRes, attRes] = await Promise.all([
      fetch(`/api/school/report-cards?school=${slug}&term=${encodeURIComponent(term)}&session=${encodeURIComponent(session)}`),
      fetch(`/api/school/attendance?school=${slug}`),
    ]);
    const rcJson = await rcRes.json();
    const attJson = await attRes.json();
    if (!rcRes.ok) {
      setError(rcJson.error || 'Could not load report cards.');
    } else {
      setReportCards(rcJson.reportCards || []);
    }
    setStudents(attJson.students || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug, term, session]);

  const updateScore = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      subject_scores: prev.subject_scores.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  const addSubjectRow = () => {
    setForm(prev => ({ ...prev, subject_scores: [...prev.subject_scores, { subject: '', score: '', grade: '', remark: '' }] }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.student_id) { setError('Pick a student first.'); return; }
    setError(null);

    const res = await fetch('/api/school/report-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school: slug,
        student_id: form.student_id,
        term, session,
        class_level: form.class_level,
        subject_scores: form.subject_scores
          .filter(s => s.subject && s.score !== '')
          .map(s => ({ ...s, score: Number(s.score) })),
        teacher_comment: form.teacher_comment,
        position_in_class: form.position_in_class ? Number(form.position_in_class) : null,
        class_size: form.class_size ? Number(form.class_size) : null,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage('Report card saved.');
      setForm({ student_id: '', class_level: '', subject_scores: emptyScores(), teacher_comment: '', position_in_class: '', class_size: '' });
      load();
    } else {
      setError(json.error || 'Could not save report card.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Module</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Report Cards</h1>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Term</label>
            <input value={term} onChange={e => setTerm(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Session</label>
            <input value={session} onChange={e => setSession(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>

        {message && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{message}</div>}
        {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

        {/* New / edit report card */}
        <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-4">
          <h2 className="font-extrabold text-brand-blue">Generate a Report Card</h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={form.student_id}
              onChange={e => setForm(prev => ({ ...prev, student_id: e.target.value, class_level: students.find(s => s.id === e.target.value)?.student_level || '' }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex-1 min-w-[200px]"
            >
              <option value="">Select student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.student_level || 'no class'})</option>)}
            </select>
            <input placeholder="Position" type="number" value={form.position_in_class} onChange={e => setForm(prev => ({ ...prev, position_in_class: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-24" />
            <input placeholder="Class size" type="number" value={form.class_size} onChange={e => setForm(prev => ({ ...prev, class_size: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-28" />
          </div>

          <div className="space-y-2">
            {form.subject_scores.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input placeholder="Subject" value={s.subject} onChange={e => updateScore(i, 'subject', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex-1" />
                <input placeholder="Score" type="number" value={s.score} onChange={e => updateScore(i, 'score', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-20" />
                <input placeholder="Grade" value={s.grade} onChange={e => updateScore(i, 'grade', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-20" />
                <input placeholder="Remark" value={s.remark} onChange={e => updateScore(i, 'remark', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-28" />
              </div>
            ))}
            <button type="button" onClick={addSubjectRow} className="text-xs font-bold text-brand-blue">+ Add subject</button>
          </div>

          <textarea
            placeholder="Class teacher's comment"
            value={form.teacher_comment}
            onChange={e => setForm(prev => ({ ...prev, teacher_comment: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={2}
          />

          <button type="submit" className="rounded-full bg-brand-blue text-white font-bold px-6 py-3">Save Report Card</button>
        </form>

        {/* Existing report cards */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-100">
          <div className="p-5"><h2 className="font-extrabold text-brand-blue">Saved Report Cards ({term}, {session})</h2></div>
          {loading ? (
            <p className="p-6 text-slate-500">Loading...</p>
          ) : reportCards.length === 0 ? (
            <p className="p-6 text-center text-slate-500">No report cards generated for this term yet.</p>
          ) : (
            reportCards.map(rc => (
              <div key={rc.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-brand-dark">{rc.profiles?.full_name}</p>
                  <p className="text-xs text-slate-400">{rc.class_level || '—'} · {(rc.subject_scores || []).length} subjects</p>
                </div>
                <a href={`/api/school/report-cards/${rc.id}/pdf`} className="text-xs font-bold rounded-full px-4 py-2 bg-brand-blue text-white">Download PDF</a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
