'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const EXAMS = ['WAEC', 'NECO'];

export default function TheoryQuestionsAdminPage() {
  const supabase = createBrowserClient();
  const [questions, setQuestions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const empty = { knowledge_asset_id: '', subject: '', topic: '', exam_type: ['WAEC', 'NECO'], question: '', marking_points: '', model_answer: '', explanation: '', status: 'draft' };
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    const [{ data: rows }, { data: assetRows }] = await Promise.all([
      supabase.from('theory_questions').select('*').order('created_at', { ascending: false }),
      supabase.from('knowledge_assets').select('id, keyword, exam_type').order('keyword'),
    ]);
    setQuestions(rows || []);
    setAssets(assetRows || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => { setForm(empty); setEditingId(null); };

  const edit = (row) => {
    setEditingId(row.id);
    setForm({
      knowledge_asset_id: row.knowledge_asset_id || '',
      subject: row.subject || '',
      topic: row.topic || '',
      exam_type: row.exam_type || [],
      question: row.question || '',
      marking_points: Array.isArray(row.marking_points) ? row.marking_points.join('\n') : '',
      model_answer: row.model_answer || '',
      explanation: row.explanation || '',
      status: row.status || 'draft',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExam = (exam) => setForm((f) => ({
    ...f,
    exam_type: f.exam_type.includes(exam) ? f.exam_type.filter((x) => x !== exam) : [...f.exam_type, exam],
  }));

  const save = async () => {
    if (!form.subject.trim() || !form.topic.trim() || !form.question.trim()) {
      alert('Subject, topic and question are required.');
      return;
    }
    if (!form.exam_type.length) {
      alert('Select at least one exam.');
      return;
    }
    const payload = {
      knowledge_asset_id: form.knowledge_asset_id || null,
      subject: form.subject.trim(),
      topic: form.topic.trim(),
      exam_type: form.exam_type,
      question: form.question.trim(),
      marking_points: form.marking_points.split('\n').map((x) => x.trim()).filter(Boolean),
      model_answer: form.model_answer.trim() || null,
      explanation: form.explanation.trim() || null,
      status: form.status,
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    const result = editingId
      ? await supabase.from('theory_questions').update(payload).eq('id', editingId)
      : await supabase.from('theory_questions').insert(payload);
    setSaving(false);
    if (result.error) { alert(result.error.message); return; }
    reset();
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this theory question?')) return;
    const { error } = await supabase.from('theory_questions').delete().eq('id', id);
    if (error) alert(error.message); else load();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-brand-blue">✍️ Theory Questions</h1>
        <p className="mt-1 text-sm text-slate-500">Create reusable WAEC/NECO theory practice linked to an existing Knowledge Asset.</p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-2">
          {EXAMS.map((exam) => (
            <button key={exam} type="button" onClick={() => toggleExam(exam)}
              className={`rounded-full border px-4 py-2 text-sm font-bold ${form.exam_type.includes(exam) ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-600'}`}>
              {exam}
            </button>
          ))}
        </div>
        <select value={form.knowledge_asset_id} onChange={(e) => setForm({...form, knowledge_asset_id:e.target.value})} className="w-full rounded-xl border p-3">
          <option value="">Link to Knowledge Asset (optional)</option>
          {assets.filter(a => (a.exam_type || []).some(x => EXAMS.includes(x))).map(a => <option key={a.id} value={a.id}>{a.keyword}</option>)}
        </select>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Subject e.g. Biology" className="rounded-xl border p-3" />
          <input value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})} placeholder="Topic e.g. Genetics" className="rounded-xl border p-3" />
        </div>
        <textarea value={form.question} onChange={e=>setForm({...form,question:e.target.value})} rows={4} placeholder="Theory question" className="w-full rounded-xl border p-3" />
        <textarea value={form.marking_points} onChange={e=>setForm({...form,marking_points:e.target.value})} rows={5} placeholder="Marking points — one point per line" className="w-full rounded-xl border p-3" />
        <textarea value={form.model_answer} onChange={e=>setForm({...form,model_answer:e.target.value})} rows={5} placeholder="Model answer" className="w-full rounded-xl border p-3" />
        <textarea value={form.explanation} onChange={e=>setForm({...form,explanation:e.target.value})} rows={3} placeholder="Explanation / examiner tip (optional)" className="w-full rounded-xl border p-3" />
        <div className="flex flex-wrap items-center gap-3">
          <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="rounded-xl border p-3">
            <option value="draft">Draft</option><option value="published">Published</option>
          </select>
          <button onClick={save} disabled={saving} className="rounded-xl bg-brand-yellow px-5 py-3 font-black disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Update Question' : 'Create Question'}</button>
          {editingId && <button onClick={reset} className="rounded-xl bg-slate-100 px-5 py-3 font-bold">Cancel</button>}
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {loading ? <div className="py-8 text-center">Loading...</div> : questions.map((row) => (
          <div key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  {row.exam_type.map(x => <span key={x} className="rounded-full bg-brand-blue/10 px-2 py-1 text-brand-blue">{x}</span>)}
                  <span className={`rounded-full px-2 py-1 ${row.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{row.status}</span>
                </div>
                <h2 className="mt-2 font-black">{row.subject} • {row.topic}</h2>
                <p className="mt-2 text-slate-700">{row.question}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>edit(row)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold">Edit</button>
                <button onClick={()=>remove(row.id)} className="rounded-xl bg-red-100 px-4 py-2 text-sm font-bold text-red-600">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
