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
  const [parsingId, setParsingId] = useState('');
  const [buildingId, setBuildingId] = useState('');

  async function load() {
    const { data: c } = await supabase.from('curricula').select('id, name, code, date_status').eq('code', 'JAMB_UTME_2026_2029').maybeSingle();
    setCurriculum(c || null);
    if (c) {
      const { data } = await supabase.from('curriculum_source_documents').select('id, file_name, file_type, status, notes, created_at, extracted_chars, source_subject').eq('curriculum_id', c.id).order('created_at', { ascending: false });
      setDocuments(data || []);
    }
  }

  useEffect(() => { load(); }, []);

  async function readApiResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    if (contentType.includes('application/json')) {
      try { return raw ? JSON.parse(raw) : {}; }
      catch { throw new Error(`Server returned invalid JSON (HTTP ${response.status}).`); }
    }
    const preview = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
    throw new Error(`Server returned HTML instead of JSON (HTTP ${response.status})${preview ? `: ${preview}` : '.'}`);
  }

  async function upload(selectedFile) {
    if (!selectedFile || !curriculum?.id) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/curriculum-sources/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ curriculum_id: curriculum.id, file_name: selectedFile.name, file_size: selectedFile.size, file_type: selectedFile.type || '', notes }) });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'Could not prepare upload.');
      const { error: storageError } = await supabase.storage.from(result.bucket).uploadToSignedUrl(result.path, result.token, selectedFile, { contentType: selectedFile.type || undefined, upsert: false });
      if (storageError) throw storageError;
      const completed = await fetch('/api/admin/curriculum-sources/complete-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ curriculum_id: curriculum.id, path: result.path, file_name: selectedFile.name, file_type: selectedFile.type || '', notes }) });
      const saved = await readApiResponse(completed);
      if (!completed.ok) throw new Error(saved.error || 'File uploaded but could not register the source.');
      setFile(null); setNotes(''); setMessage('Syllabus source uploaded directly to Supabase Storage. Extract text, then build the syllabus.'); await load();
    } catch (error) { setMessage(error.message || 'Upload failed.'); } finally { setBusy(false); }
  }

  async function parseSource(doc) {
    setParsingId(doc.id);
    setMessage('');
    try {
      const response = await fetch('/api/admin/curriculum-sources/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'Could not parse source');
      setMessage(result.document.file_name + ': extracted ' + result.document.extracted_chars.toLocaleString() + ' characters. Text is staged for review; it has not automatically replaced published syllabus topics.');
      await load();
    } catch (error) { setMessage(error.message); await load(); }
    finally { setParsingId(''); }
  }
  async function buildSyllabus(doc) {
    setBuildingId(doc.id); setMessage('');
    try {
      const response = await fetch('/api/admin/curriculum-sources/build-syllabus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: doc.id }) });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'Could not build syllabus.');
      setMessage(result.subject + ': ' + result.topics_added + ' topics/subtopics added, ' + result.topics_already_existing + ' already existed, ' + result.objectives_added + ' objectives added; ' + (result.chunks_failed?.length || 0) + ' chunks failed. Status: ' + result.status + '.'); await load();
    } catch (error) { setMessage(error.message || 'Could not build syllabus.'); await load(); } finally { setBuildingId(''); }
  }

  async function importIbass(source) {
    if (!curriculum?.id) return;
    setImportingUrl(source.url);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/curriculum-sources/import-url?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculum_id: curriculum.id, source_url: source.url }),
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'IBASS import failed');
      setMessage(`${source.subject} imported from official IBASS: ${result.document.extracted_chars.toLocaleString()} characters extracted. It is staged, not published as syllabus nodes.`);
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setImportingUrl(''); }
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
            <p className="mt-1 text-sm text-slate-500">These are official JAMB IBASS PDF sources. If IBASS blocks automatic download, download the PDF in your browser and upload it here.</p>
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

          <section className="mt-5 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Import directly from JAMB IBASS</h2>
            <p className="mt-1 text-sm text-slate-500">Test with official IBASS syllabus PDFs. The PDF is fetched server-side, text is extracted, and the source is staged. It does not publish curriculum topics automatically.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input id="ibass-chemistry-url" defaultValue="https://ibass.jamb.gov.ng/assets/uploads/Chemistry.pdf" className="w-full rounded-xl border p-3 text-sm" />
              <input id="ibass-biology-url" defaultValue="https://ibass.jamb.gov.ng/assets/uploads/Biology.pdf" className="w-full rounded-xl border p-3 text-sm" />
            </div>
            <button
              disabled={!curriculum?.id || busy}
              onClick={async () => {
                setBusy(true);
                setMessage('');
                try {
                  const urls = [
                    document.getElementById('ibass-chemistry-url')?.value?.trim(),
                    document.getElementById('ibass-biology-url')?.value?.trim(),
                  ].filter(Boolean);
                  for (const source_url of urls) {
                    const response = await fetch('/api/admin/curriculum-sources/import-url', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ curriculum_id: curriculum.id, source_url }),
                    });
                    const result = await readApiResponse(response);
                    if (!response.ok) throw new Error(result.error || 'IBASS import failed');
                  }
                  setMessage('IBASS test import completed for the two PDF URLs.');
                  await load();
                } catch (error) {
                  setMessage(error.message);
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-4 w-full rounded-xl bg-brand-blue px-5 py-3 font-black text-white disabled:opacity-50"
            >
              {busy ? 'Importing from IBASS...' : 'Test import 2 IBASS PDFs'}
            </button>
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
                    <div><p className="font-bold">{doc.file_name}</p><p className="text-xs text-slate-500">{doc.file_type} • {new Date(doc.created_at).toLocaleString('en-NG')}</p>{doc.extracted_chars > 0 && <p className="mt-1 text-xs font-bold text-green-700">{doc.extracted_chars.toLocaleString()} characters extracted</p>}{doc.notes && <p className="mt-1 text-xs text-slate-500">{doc.notes}</p>}</div>
                    <div className="flex items-center gap-2"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">{doc.status}</span>{doc.status !== 'parsed' && doc.status !== 'published' && <button disabled={!!parsingId || busy || !!buildingId} onClick={() => parseSource(doc)} className="rounded-xl bg-brand-blue px-3 py-2 text-xs font-black text-white disabled:opacity-50">{parsingId === doc.id ? 'Parsing...' : doc.status === 'failed' ? 'Retry extraction' : 'Extract text'}</button>}{(doc.status === 'parsed' || doc.status === 'failed' || doc.status === 'published') && doc.extracted_chars > 0 && <button disabled={!!buildingId || busy || !!parsingId} onClick={() => buildSyllabus(doc)} className="rounded-xl bg-brand-yellow px-3 py-2 text-xs font-black text-brand-dark disabled:opacity-50">{buildingId === doc.id ? 'Building...' : 'Build syllabus'}</button>}</div>
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
