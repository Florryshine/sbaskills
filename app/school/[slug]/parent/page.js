'use client';

import { useEffect, useState } from 'react';

const STATUS_LABEL = {
  present: 'Present', absent: 'Absent', sick: 'Sick', improving: 'Improving',
  excellent: 'Excellent', needs_attention: 'Needs attention', misbehaving: 'Misbehaving', other: 'Note',
};
const STATUS_STYLE = {
  present: 'bg-green-100 text-green-700', absent: 'bg-red-100 text-red-700',
  sick: 'bg-amber-100 text-amber-700', improving: 'bg-blue-100 text-blue-700',
  excellent: 'bg-emerald-100 text-emerald-700', needs_attention: 'bg-orange-100 text-orange-700',
  misbehaving: 'bg-red-100 text-red-700', other: 'bg-slate-100 text-slate-600',
};

function average(rc) {
  const rows = rc.subject_scores || [];
  if (!rows.length) return 0;
  const sum = rows.reduce((a, r) => a + (Number(r.total !== undefined ? r.total : r.score) || 0), 0);
  return Math.round((sum / rows.length) * 10) / 10;
}

export default function ParentDashboardPage() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/school/parent-dashboard');
      const json = await res.json();
      if (!res.ok) setError(json.error || 'Could not load your dashboard.');
      else setChildren(json.children || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading...</div>;

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="rounded-xl bg-red-50 border border-red-100 px-6 py-4 text-sm text-red-600">{error}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Parent Dashboard</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">My Children</h1>
        </div>

        {children.length === 0 && (
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100 text-center text-slate-500">
            No children are linked to your account yet. Ask the school office to link your child's account to yours.
          </div>
        )}

        {children.map(child => {
          const sortedCards = [...child.reportCards].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const latest = child.reportCards[0];

          return (
            <div key={child.id} className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-extrabold text-brand-dark text-lg">{child.full_name}</h2>
                  <p className="text-xs text-slate-400">{child.student_level || 'No class assigned'}</p>
                </div>
                {latest && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Latest average</p>
                    <p className="text-xl font-extrabold text-brand-blue">{average(latest)}%</p>
                  </div>
                )}
              </div>

              {/* Improvement over time */}
              {sortedCards.length > 1 && (
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-500 mb-3">Performance over time</h3>
                  <div className="flex items-end gap-2 h-24">
                    {sortedCards.map(rc => (
                      <div key={rc.id} className="flex-1 flex flex-col items-center justify-end">
                        <div
                          className="w-full rounded-t bg-brand-blue/80"
                          style={{ height: `${Math.max(6, average(rc))}%` }}
                          title={`${rc.term} ${rc.session}: ${average(rc)}%`}
                        />
                        <span className="text-[10px] text-slate-400 mt-1 text-center">{rc.term.replace(' Term', '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Report cards */}
              <div className="divide-y divide-slate-100">
                {child.reportCards.length === 0 ? (
                  <p className="p-6 text-center text-slate-500 text-sm">No report cards published yet.</p>
                ) : (
                  child.reportCards.map(rc => (
                    <div key={rc.id} className="p-5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-brand-dark">{rc.term} &middot; {rc.session}</p>
                        <p className="text-xs text-slate-400">
                          Average {average(rc)}%
                          {rc.position_in_class ? ` · Position ${rc.position_in_class} of ${rc.class_size}` : ''}
                        </p>
                      </div>
                      <a href={`/api/school/report-cards/${rc.id}/pdf`} className="text-xs font-bold rounded-full px-4 py-2 bg-brand-blue text-white">Download PDF</a>
                    </div>
                  ))
                )}
              </div>

              {/* Daily observations */}
              {child.observations.length > 0 && (
                <div className="p-6 bg-slate-50 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-500 mb-3">Recent teacher notes</h3>
                  <ul className="space-y-2">
                    {child.observations.slice(0, 10).map(o => (
                      <li key={o.id} className="flex items-start gap-3 text-sm">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[o.status] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                        <span className="text-slate-600">
                          {o.note || ''} <span className="text-slate-400">&middot; {new Date(o.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
