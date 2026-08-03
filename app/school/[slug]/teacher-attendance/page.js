'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function TeacherAttendancePage() {
  const { slug } = useParams();
  const [records, setRecords] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [recRes, meRes] = await Promise.all([
      fetch(`/api/school/teacher-attendance?school=${slug}`),
      fetch(`/api/school/me?school=${slug}`),
    ]);
    const recJson = await recRes.json();
    if (!recRes.ok) setError(recJson.error || 'Could not load records.');
    else setRecords(recJson.records || []);
    if (meRes.ok) {
      const meJson = await meRes.json();
      setMe(meJson.profile);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  const act = async (action) => {
    setSaving(true);
    setError(null);
    const res = await fetch('/api/school/teacher-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, action }),
    });
    const json = await res.json();
    if (res.ok) load();
    else setError(json.error || 'Could not save.');
    setSaving(false);
  };

  const myRecord = records.find(r => r.teacher_id === me?.id);
  const isPrincipalOrAdmin = me && ['principal', 'admin'].includes(me.role);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Module</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Teacher Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Check in when you arrive, check out when you close for the day.</p>
        </div>

        {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

        {me && ['teacher', 'principal'].includes(me.role) && (
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center space-y-4">
            <p className="text-slate-500 text-sm">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {me.full_name?.split(' ')[0]}</p>
            <div className="flex items-center justify-center gap-6">
              <div>
                <p className="text-xs text-slate-400">Check-in</p>
                <p className="text-lg font-extrabold text-brand-dark">{fmtTime(myRecord?.check_in_at)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Check-out</p>
                <p className="text-lg font-extrabold text-brand-dark">{fmtTime(myRecord?.check_out_at)}</p>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => act('check_in')}
                disabled={saving || !!myRecord?.check_in_at}
                className="rounded-full bg-green-600 text-white font-bold px-6 py-3 disabled:opacity-40"
              >
                Check In
              </button>
              <button
                onClick={() => act('check_out')}
                disabled={saving || !myRecord?.check_in_at || !!myRecord?.check_out_at}
                className="rounded-full bg-brand-blue text-white font-bold px-6 py-3 disabled:opacity-40"
              >
                Check Out
              </button>
            </div>
          </div>
        )}

        {isPrincipalOrAdmin && (
          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-100">
            <div className="p-5"><h2 className="font-extrabold text-brand-blue">Today's Attendance</h2></div>
            {loading ? (
              <p className="p-6 text-slate-500">Loading...</p>
            ) : records.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No teacher has checked in yet today.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Teacher</th>
                      <th className="px-6 py-3 font-semibold">Check-in</th>
                      <th className="px-6 py-3 font-semibold">Check-out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map(r => (
                      <tr key={r.id}>
                        <td className="px-6 py-3 font-bold text-brand-dark">{r.profiles?.full_name}</td>
                        <td className="px-6 py-3 text-slate-600">{fmtTime(r.check_in_at)}</td>
                        <td className="px-6 py-3 text-slate-600">{fmtTime(r.check_out_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
