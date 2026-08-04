'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const AUDIENCES = [
  ['all', 'Everyone'],
  ['students', 'Students'],
  ['teachers', 'Teachers'],
  ['parents', 'Parents'],
];

export default function AnnouncementsPage() {
  const { slug } = useParams();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ title: '', message: '', audience: 'all', is_public: true });

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/school/announcements?school=${slug}&limit=30`);
    const json = await res.json();
    if (!res.ok) setError(json.error || 'Could not load announcements.');
    else setAnnouncements(json.announcements || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) return;
    setError(null);
    const res = await fetch('/api/school/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, ...form }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage('Announcement sent.');
      setForm({ title: '', message: '', audience: 'all', is_public: true });
      load();
    } else {
      setError(json.error || 'Could not send announcement.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Module</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Announcements</h1>
          <p className="mt-1 text-sm text-slate-500">
            Public announcements also show up on your school's public page under "News &amp; Announcements".
          </p>
        </div>

        {message && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{message}</div>}
        {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-3">
          <input
            placeholder="Title (e.g. School resumes Monday)"
            value={form.title}
            onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Message"
            value={form.message}
            onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={form.audience}
              onChange={e => setForm(prev => ({ ...prev, audience: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {AUDIENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={e => setForm(prev => ({ ...prev, is_public: e.target.checked }))}
              />
              Show on public school page
            </label>
            <button type="submit" className="ml-auto rounded-full bg-brand-blue text-white font-bold px-6 py-2">Send</button>
          </div>
        </form>

        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-100">
          {loading ? (
            <p className="p-6 text-slate-500">Loading...</p>
          ) : announcements.length === 0 ? (
            <p className="p-6 text-center text-slate-500">No announcements sent yet.</p>
          ) : (
            announcements.map(a => (
              <div key={a.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-brand-dark">{a.title}</p>
                  <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-slate-100 text-slate-500">{a.audience}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{a.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(a.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {!a.is_public && ' · Internal only'}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
