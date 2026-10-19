'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const dateTime = (value) => value ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function AdminQuizPerformancePage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quizFilter, setQuizFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push('/admin/login'); return; }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profileError || profile?.role !== 'admin') { router.push('/login'); return; }

      const [attemptResult, profilesResult, quizzesResult, draftsResult] = await Promise.all([
        supabase.from('quiz_attempts').select('id,student_id,quiz_id,score,total_questions,answers,created_at,completed_at,status,started_at,updated_at').order('created_at', { ascending: false }).limit(2000),
        supabase.from('profiles').select('id,full_name,email').eq('role', 'student').limit(5000),
        supabase.from('quizzes').select('id,title,tutor_id'),
        supabase.from('quiz_drafts').select('id,keyword,status'),
      ]);
      if (attemptResult.error) throw attemptResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (quizzesResult.error) throw quizzesResult.error;
      // Draft reads may be restricted by RLS; manual quiz attempts still remain visible.
      const students = Object.fromEntries((profilesResult.data || []).map(p => [p.id, p]));
      const quizzes = Object.fromEntries((quizzesResult.data || []).map(q => [q.id, { title: q.title || 'Untitled quiz', type: 'Manual quiz' }]));
      (draftsResult.data || []).forEach(q => { quizzes[q.id] = { title: q.keyword || 'Generated quiz', type: 'Generated quiz' }; });

      const source = attemptResult.data || [];
      const attemptCounts = {};
      source.forEach(a => {
        const key = String(a.student_id || 'unknown') + ':' + String(a.quiz_id || 'unknown');
        attemptCounts[key] = (attemptCounts[key] || 0) + 1;
      });
      const now = Date.now();
      setRows(source.map(a => {
        const student = students[a.student_id] || {};
        const quiz = quizzes[a.quiz_id] || { title: 'Quiz title unavailable', type: 'Unknown quiz type' };
        const stale = a.status !== 'completed' && !a.completed_at && a.updated_at && now - new Date(a.updated_at).getTime() > 30 * 60 * 1000;
        const status = a.completed_at || a.status === 'completed' ? 'Completed' : stale ? 'Inactive (30m+)' : 'In progress';
        const answers = a.answers && typeof a.answers === 'object' ? a.answers : {};
        const answeredCount = Array.isArray(answers) ? answers.filter(v => v !== null && v !== '').length : Object.values(answers).filter(v => v !== null && v !== '').length;
        const key = String(a.student_id || 'unknown') + ':' + String(a.quiz_id || 'unknown');
        return { ...a, student_name: student.full_name || 'Unnamed student', student_email: student.email || '', quiz_title: quiz.title, quiz_type: quiz.type, status, attempt_count: attemptCounts[key] || 1, answered_count: answeredCount };
      }));
    } catch (e) {
      console.error('Admin quiz performance failed:', e);
      setError(e?.message || 'Could not load quiz performance. Check the database migration and permissions, then refresh.');
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => { load(); }, [load]);

  const quizOptions = useMemo(() => [...new Set(rows.map(r => r.quiz_id).filter(Boolean).map(id => JSON.stringify({ id, title: rows.find(r => r.quiz_id === id)?.quiz_title || 'Quiz' })))].map(v => JSON.parse(v)).sort((a,b) => a.title.localeCompare(b.title)), [rows]);
  const filtered = useMemo(() => rows.filter(r => {
    const term = search.trim().toLowerCase();
    const matchText = !term || [r.student_name, r.student_email, r.quiz_title, r.quiz_type].some(v => String(v || '').toLowerCase().includes(term));
    const matchStatus = statusFilter === 'all' || (statusFilter === 'completed' && r.status === 'Completed') || (statusFilter === 'in_progress' && r.status === 'In progress') || (statusFilter === 'inactive' && r.status === 'Inactive (30m+)');
    return matchText && matchStatus && (quizFilter === 'all' || r.quiz_id === quizFilter);
  }), [rows, search, statusFilter, quizFilter]);
  const completed = rows.filter(r => r.status === 'Completed').length;
  const uniqueStudents = new Set(rows.map(r => r.student_id).filter(Boolean)).size;

  const exportCsv = () => {
    const headers = ['Student', 'Email', 'Quiz', 'Quiz type', 'Attempt count for this student and quiz', 'Score percent', 'Total questions', 'Status', 'Started', 'Last updated', 'Submitted'];
    const quote = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [headers, ...filtered.map(r => [r.student_name, r.student_email, r.quiz_title, r.quiz_type, r.attempt_count, r.score, r.total_questions, r.status, r.started_at || r.created_at, r.updated_at || r.created_at, r.completed_at])].map(row => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sba-quiz-performance-' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading) return <div className="py-20 text-center text-slate-500">Loading student quiz performance…</div>;

  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Learning analytics</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold text-brand-blue">Student Quiz Performance</h1><p className="mt-1 text-sm text-slate-500">See who attempted each quiz, how many times they tried, their scores, and saved answer progress.</p></div>
        <div className="flex gap-2"><button onClick={load} className="rounded-xl border px-4 py-2 text-sm font-bold">Refresh</button><button onClick={exportCsv} className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-bold text-white">Export CSV</button></div>
      </div>
      {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load quiz attempts: {error}</div>}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs text-slate-500">Recorded attempts</p><p className="text-2xl font-black text-brand-blue">{rows.length}</p></div>
        <div className="rounded-xl bg-green-50 p-4"><p className="text-xs text-slate-500">Completed attempts</p><p className="text-2xl font-black text-green-700">{completed}</p></div>
        <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs text-slate-500">In progress / inactive</p><p className="text-2xl font-black text-amber-700">{rows.length - completed}</p></div>
        <div className="rounded-xl bg-violet-50 p-4"><p className="text-xs text-slate-500">Students with attempts</p><p className="text-2xl font-black text-violet-700">{uniqueStudents}</p></div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, email or quiz…" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-blue" />
        <select value={quizFilter} onChange={e => setQuizFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option value="all">All quizzes</option>{quizOptions.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option value="all">All statuses</option><option value="completed">Completed</option><option value="in_progress">In progress</option><option value="inactive">Inactive (30m+)</option></select>
      </div>
      <p className="mt-3 text-xs text-slate-500">Showing {filtered.length} of {rows.length} records (latest 2,000). Inactivity is an estimate, not proof a student abandoned the quiz.</p>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Details</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{filtered.map(r => <><tr key={r.id} className="align-top hover:bg-slate-50">
          <td className="px-4 py-4"><p className="font-bold text-slate-800">{r.student_name}</p><p className="mt-1 text-xs text-slate-500">{r.student_email || 'No email available'}</p></td>
          <td className="px-4 py-4"><p className="font-semibold">{r.quiz_title}</p><p className="mt-1 text-xs text-slate-500">{r.quiz_type}</p></td>
          <td className="px-4 py-4 font-bold">{r.attempt_count}</td>
          <td className="px-4 py-4"><span className="font-extrabold">{r.score ?? 0}%</span><p className="text-xs text-slate-500">{Math.round((Number(r.score) || 0) * (Number(r.total_questions) || 0) / 100)} / {r.total_questions ?? 0} correct (estimated)</p></td>
          <td className="px-4 py-4"><span className={'whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ' + (r.status === 'Completed' ? 'bg-green-100 text-green-700' : r.status === 'In progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800')}>{r.status}</span><p className="mt-2 text-xs text-slate-500">{r.answered_count} answered</p></td>
          <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">Started: {dateTime(r.started_at || r.created_at)}<br/>Updated: {dateTime(r.updated_at || r.created_at)}<br/>Submitted: {dateTime(r.completed_at)}</td>
          <td className="px-4 py-4"><button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="rounded-lg border px-3 py-2 text-xs font-bold text-brand-blue">{expanded === r.id ? 'Hide answers' : 'View answers'}</button></td>
        </tr>{expanded === r.id && <tr key={r.id + '-answers'}><td colSpan="7" className="bg-slate-50 px-4 py-4"><p className="mb-2 font-bold">Saved answer data</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-4 text-xs">{JSON.stringify(r.answers || {}, null, 2)}</pre><p className="mt-2 text-xs text-slate-500">Attempt ID: {r.id} · Student ID: {r.student_id || 'unknown'} · Quiz ID: {r.quiz_id || 'unknown'}</p></td></tr>}</>)}
        {!filtered.length && <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">{error ? 'Fix the error above, then refresh.' : 'No quiz attempts match these filters yet.'}</td></tr>}</tbody>
      </table></div>
    </section>
  </div>;
}
