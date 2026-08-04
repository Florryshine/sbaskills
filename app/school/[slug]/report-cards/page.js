'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { computeSubjectRow, DEFAULT_SCALE } from '@/lib/school/grading';

const DEFAULT_SESSION = '2025/2026';
const DEFAULT_TERM = 'First Term';
const DEFAULT_SUBJECTS = ['Mathematics', 'English Language', 'Biology'];

function emptyScores() {
  return DEFAULT_SUBJECTS.map(subject => ({ subject, ca1: '', ca2: '', exam: '' }));
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
  const [isPrincipal, setIsPrincipal] = useState(false);

  const [form, setForm] = useState({
    student_id: '', class_level: '', subject_scores: emptyScores(),
    teacher_comment: '', principal_comment: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    const [rcRes, attRes, meRes] = await Promise.all([
      fetch(`/api/school/report-cards?school=${slug}&term=${encodeURIComponent(term)}&session=${encodeURIComponent(session)}`),
      fetch(`/api/school/attendance?school=${slug}`),
      fetch(`/api/school/me?school=${slug}`),
    ]);
    const rcJson = await rcRes.json();
    const attJson = await attRes.json();
    if (!rcRes.ok) {
      setError(rcJson.error || 'Could not load report cards.');
    } else {
      setReportCards(rcJson.reportCards || []);
    }
    setStudents(attJson.students || []);
    if (meRes.ok) {
      const meJson = await meRes.json();
      setIsPrincipal(meJson.profile?.role === 'principal' || meJson.profile?.role === 'admin');
    }
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
    setForm(prev => ({ ...prev, subject_scores: [...prev.subject_scores, { subject: '', ca1: '', ca2: '', exam: '' }] }));
  };

  const removeSubjectRow = (index) => {
    setForm(prev => ({ ...prev, subject_scores: prev.subject_scores.filter((_, i) => i !== index) }));
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
          .filter(s => s.subject && (s.ca1 !== '' || s.ca2 !== '' || s.exam !== ''))
          .map(s => ({ subject: s.subject, ca1: Number(s.ca1) || 0, ca2: Number(s.ca2) || 0, exam: Number(s.exam) || 0 })),
        teacher_comment: form.teacher_comment,
        principal_comment: form.principal_comment,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage(`Report card saved. Average: ${json.average}%`);
      setForm({ student_id: '', class_level: '', subject_scores: emptyScores(), teacher_comment: '', principal_comment: '' });
      load();
    } else {
      setError(json.error || 'Could not save report card.');
    }
  };

  // Live preview of totals/grades as the teacher types, using the default
  // scale client-side (the API recomputes against the school's real scale
  // on save, so this is just for instant feedback).
  const previewRows = form.subject_scores.map(s => computeSubjectRow(s, DEFAULT_SCALE));
  const previewAverage = previewRows.length
    ? Math.round((previewRows.reduce((a, r) => a + r.total, 0) / previewRows.length) * 10) / 10
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Module</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Report Cards</h1>
          <p className="text-sm text-slate-500 mt-1">Enter CA1, CA2 and Exam scores — total, grade and class position are calculated automatically.</p>
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
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem_4.5rem_3.5rem_2rem] gap-2 text-xs font-bold text-slate-400 px-1">
              <span>Subject</span><span>CA1</span><span>CA2</span><span>Exam</span><span>Total</span><span>Grade</span><span></span>
            </div>
            {form.subject_scores.map((s, i) => {
              const computed = computeSubjectRow(s, DEFAULT_SCALE);
              return (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem_4.5rem_3.5rem_2rem] gap-2 items-center">
                  <input placeholder="Subject" value={s.subject} onChange={e => updateScore(i, 'subject', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input placeholder="0-30" type="number" value={s.ca1} onChange={e => updateScore(i, 'ca1', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                  <input placeholder="0-30" type="number" value={s.ca2} onChange={e => updateScore(i, 'ca2', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                  <input placeholder="0-40" type="number" value={s.exam} onChange={e => updateScore(i, 'exam', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                  <span className="text-sm font-bold text-brand-dark text-center">{computed.total}</span>
                  <span className="text-sm font-bold text-brand-blue text-center">{computed.grade}</span>
                  <button type="button" onClick={() => removeSubjectRow(i)} className="text-red-400 text-lg leading-none">×</button>
                </div>
              );
            })}
            <button type="button" onClick={addSubjectRow} className="text-xs font-bold text-brand-blue">+ Add subject</button>
            {previewRows.length > 0 && (
              <p className="text-xs text-slate-500 pt-1">Average so far: <span className="font-bold text-brand-dark">{previewAverage}%</span></p>
            )}
          </div>

          <textarea
            placeholder="Class teacher's comment"
            value={form.teacher_comment}
            onChange={e => setForm(prev => ({ ...prev, teacher_comment: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={2}
          />

          {isPrincipal && (
            <textarea
              placeholder="Principal's comment"
              value={form.principal_comment}
              onChange={e => setForm(prev => ({ ...prev, principal_comment: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={2}
            />
          )}

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
                  <p className="text-xs text-slate-400">
                    {rc.class_level || '—'} · {(rc.subject_scores || []).length} subjects
                    {rc.position_in_class ? ` · Position ${rc.position_in_class} of ${rc.class_size}` : ''}
                  </p>
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
