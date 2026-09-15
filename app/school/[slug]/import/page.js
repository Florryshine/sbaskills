'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { parseCsv, rowsToCsv } from '@/lib/school/csv';

const HEADERS = {
  student: ['full_name', 'email', 'student_level', 'password'],
  teacher: ['full_name', 'email', 'password'],
  parent: ['full_name', 'email', 'password'],
};

export default function SchoolImportPage() {
  const { slug } = useParams();
  const [role, setRole] = useState('student');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function loadHistory() {
    const response = await fetch(`/api/school/bulk-import?school=${encodeURIComponent(slug)}`);
    const json = await response.json();
    if (response.ok) setJobs(json.jobs || []);
  }
  useEffect(() => { if (slug) loadHistory(); }, [slug]);

  const preview = useMemo(() => rows.slice(0, 8), [rows]);

  function downloadTemplate() {
    const headers = HEADERS[role];
    const csv = rowsToCsv(headers, [Object.fromEntries(headers.map(header => [header, header === 'full_name' ? 'Okafor, Chidera Jr.' : header === 'email' ? 'example@school.com' : header === 'student_level' ? 'SS1' : '']))]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `sba-${role}-template.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null); setResult(null); setFileName(file.name);
    try { setRows(parseCsv(await file.text())); }
    catch (parseError) { setRows([]); setError(parseError.message); }
  }

  async function importRows() {
    setBusy(true); setError(null);
    const response = await fetch('/api/school/bulk-import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, role, file_name: fileName, rows }),
    });
    const json = await response.json(); setBusy(false);
    if (!response.ok) { setError(json.error || 'Import failed.'); return; }
    setResult(json); setRows([]); await loadHistory();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div><p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School operations</p><h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Bulk import people</h1><p className="mt-1 text-sm text-slate-500">Add up to 500 students, teachers, or parents with a safe row-by-row import.</p></div>
          <a href={`/school/${slug}/manage-people`} className="text-sm font-bold text-brand-blue">Back to people</a>
        </div>
        <section className="rounded-2xl bg-white p-6 border border-slate-100 shadow-sm space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-semibold text-slate-700">Role<select value={role} onChange={event => { setRole(event.target.value); setRows([]); }} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2"><option value="student">Students</option><option value="teacher">Teachers</option><option value="parent">Parents</option></select></label>
            <button type="button" onClick={downloadTemplate} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Download CSV template</button>
            <label className="rounded-full bg-brand-blue px-4 py-2 text-sm font-bold text-white cursor-pointer">Choose CSV<input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" /></label>
          </div>
          {fileName && <p className="text-sm text-slate-500">{fileName} · {rows.length} parsed data rows</p>}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          {preview.length > 0 && <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr>{HEADERS[role].map(header => <th key={header} className="text-left px-3 py-2 bg-slate-50 text-slate-500">{header}</th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index} className="border-t border-slate-100">{HEADERS[role].map(header => <td key={header} className="px-3 py-2 text-slate-700">{row[header] || '—'}</td>)}</tr>)}</tbody></table>{rows.length > preview.length && <p className="mt-2 text-xs text-slate-400">Showing first {preview.length} rows.</p>}</div>}
          <button type="button" onClick={importRows} disabled={busy || rows.length === 0} className="rounded-full bg-brand-yellow px-5 py-2 text-sm font-extrabold text-brand-dark disabled:opacity-50">{busy ? 'Importing…' : `Import ${rows.length || ''} ${role}s`}</button>
          {result && <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800"><strong>{result.added} added</strong> · {result.skipped} skipped. {result.errors?.length > 0 && <span>{result.errors[0].reason}</span>}{result.created?.some(item => item.temporary_password) && <details className="mt-3"><summary className="font-bold cursor-pointer">Show generated temporary passwords</summary><pre className="mt-2 whitespace-pre-wrap text-xs">{result.created.filter(item => item.temporary_password).map(item => `${item.email}: ${item.temporary_password}`).join('\n')}</pre></details>}</div>}
        </section>
        <section className="rounded-2xl bg-white p-6 border border-slate-100 shadow-sm"><h2 className="text-lg font-extrabold text-brand-blue">Import history</h2><div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr><th className="text-left py-2 text-slate-500">File</th><th className="text-left py-2 text-slate-500">Role</th><th className="text-left py-2 text-slate-500">Rows</th><th className="text-left py-2 text-slate-500">Added</th><th className="text-left py-2 text-slate-500">Skipped</th><th className="text-left py-2 text-slate-500">Date</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id} className="border-t border-slate-100"><td className="py-2">{job.file_name}</td><td>{job.role}</td><td>{job.total_rows}</td><td className="text-emerald-700">{job.success_count}</td><td className="text-amber-700">{job.error_count}</td><td className="text-slate-500">{new Date(job.created_at).toLocaleString('en-NG')}</td></tr>)}</tbody></table>{jobs.length === 0 && <p className="mt-4 text-sm text-slate-500">No imports yet.</p>}</div></section>
      </div>
    </main>
  );
}
