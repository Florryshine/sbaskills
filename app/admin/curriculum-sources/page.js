'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createBrowserClient } from '@/lib/supabase';

const ACCEPT = '.txt,.csv,.pdf,.xlsx,.xls,.docx,.doc';

const IBASS_TEST_SOURCES = [
  { subject: 'Chemistry', url: 'https://ibass.jamb.gov.ng/assets/uploads/Chemistry.pdf' },
  { subject: 'Biology', url: 'https://ibass.jamb.gov.ng/assets/uploads/Biology.pdf' },
];


export default function CurriculumSourcesPage() {
  const supabase = createBrowserClient();
  const [curriculum, setCurriculum] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [importingUrl, setImportingUrl] = useState('');

  async function load() {
    const { data: c } = await supabase.from('curricula').select('id, name, code, date_status').eq('code', 'JAMB_UTME_2026_2029').maybeSingle();
    setCurriculum(c || null);
    if (c) {
      const { data } = await supabase.from('curriculum_source_documents').select('id, file_name, file_type, status, notes, created_at').eq('curriculum_id', c.id).order('created_at', { ascending: false });
      setDocuments(data || []);
    }
  }

  useEffect(() => { load(); }, []);

  async function upload(selectedFile) {
    if (!selectedFile || !curriculum?.id) return;
    setBusy(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('curriculum_id', curriculum.id);
      form.append('notes', notes);
      const response = await fetch('/api/admin/curriculum-sources/upload', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed');
      setFile(null);
      setNotes('');
      setMessage('Syllabus source uploaded. It is staged for parsing later.');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function importIbass(source) {
    if (!curriculum?.id) return;
    setImportingUrl(source.url);
    setMessage('');
    try {
      const response = await fetch('/api/admin/curriculum-sources/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculum_id: curriculum.id, source_url: source.url }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'IBASS import failed');
      setMessage(`${source.subject} imported from official IBASS: ${result.document.extracted_chars.toLocaleString()} characters extracted. It is staged, not published as syllabus nodes.`);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setImportingUrl('');
    }
  }

  async function saveText() {
    const value = text.trim();
    if (!value || !curriculum?.id) return;
    const blob = new File([value], `jamb-syllabus-${new Date().toISOString().slice(0,10)}.txt`, { type: 'text/plain' });
    await upload(blob);
    setText('');
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl px-4">
          <div className="rounded-3xl bg-brand-blue p-6 text-white sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-100">ADMIN • CURRICULUM</p>
            <h1 className="mt-2 text-3xl font-black">JAMB syllabus sources</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">Upload the official syllabus when you have it. Nothing here is treated as the official syllabus until you approve/populate it.</p>
            {curriculum && <p className="mt-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{curriculum.name} • {curriculum.date_status}</p>}
          </div>

          <section className="mt-5 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Test official IBASS import</h2>
            <p className="mt-1 text-sm text-slate-500">These are two official JAMB IBASS PDF sources. Importing only stages the source and extracted text; it does not publish syllabus content.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {IBASS_TEST_SOURCES.map((source) => (
                <div key={source.url} className="rounded-2xl border p-4">
                  <p className="font-black">{source.subject}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{source.url}</p>
                  <button
                    disabled={!!importingUrl}
                    onClick={() => importIbass(source)}
                    className="mt-4 w-full rounded-xl bg-brand-blue px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    {importingUrl === source.url ? 'Importing...' : `Import ${source.subject}`}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Upload a file</h2>
              <p className="mt-1 text-sm text-slate-500">Accepted: TXT, CSV, Excel, Word and PDF. Max 15MB.</p>
              <input type="file" accept={ACCEPT} className="mt-5 block w-full rounded-xl border p-3 text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note, e.g. JAMB official 2027 syllabus" className="mt-4 min-h-24 w-full rounded-xl border p-3 text-sm" />
              <button disabled={!file || busy} onClick={() => upload(file)} className="mt-4 w-full rounded-xl bg-brand-yellow px-5 py-3 font-black text-brand-dark disabled:opacity-50">{busy ? 'Uploading...' : 'Upload syllabus source'}</button>
            </section>

            <section className="rounded-3xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Paste syllabus text</h2>
              <p className="mt-1 text-sm text-slate-500">Useful if you have copied the syllabus from a document or webpage.</p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste syllabus text here..." className="mt-5 min-h-48 w-full rounded-xl border p-3 text-sm" />
              <button disabled={!text.trim() || busy} onClick={saveText} className="mt-4 w-full rounded-xl bg-brand-blue px-5 py-3 font-black text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save pasted text'}</button>
            </section>
          </div>

          {message && <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-brand-blue">{message}</div>}

          <section className="mt-5 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Staged sources</h2>
            {documents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No syllabus source uploaded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-bold">{doc.file_name}</p><p className="text-xs text-slate-500">{doc.file_type} • {new Date(doc.created_at).toLocaleString('en-NG')}</p>{doc.notes && <p className="mt-1 text-xs text-slate-500">{doc.notes}</p>}</div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">{doc.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
