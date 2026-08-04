'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const DEFAULT_SESSION = '2025/2026';
const DEFAULT_TERM = 'First Term';

export default function FeesPage() {
  const { slug } = useParams();
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [session, setSession] = useState(DEFAULT_SESSION);
  const [balances, setBalances] = useState([]);
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const [newFee, setNewFee] = useState({ title: 'School Fees', amount: '', class_level: '', due_date: '' });
  const [paymentDraft, setPaymentDraft] = useState({});
  const [selected, setSelected] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ school: slug, term, session });
    const res = await fetch(`/api/school/fees?${params}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Could not load fees.');
    } else {
      setBalances(json.balances || []);
      setStructures(json.structures || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug, term, session]);

  const createStructure = async (e) => {
    e.preventDefault();
    if (!newFee.amount) return;
    const res = await fetch('/api/school/fees/structures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school: slug, term, session,
        title: newFee.title, amount: Number(newFee.amount),
        class_level: newFee.class_level || null,
        due_date: newFee.due_date || null,
      }),
    });
    if (res.ok) {
      setNewFee({ title: 'School Fees', amount: '', class_level: '', due_date: '' });
      setMessage('Fee structure created.');
      load();
    }
  };

  const recordPayment = async (studentId, feeStructureId) => {
    const amount = Number(paymentDraft[studentId]);
    if (!amount) return;
    const res = await fetch('/api/school/fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, student_id: studentId, fee_structure_id: feeStructureId, amount, method: 'cash' }),
    });
    if (res.ok) {
      setPaymentDraft(prev => ({ ...prev, [studentId]: '' }));
      setMessage('Payment recorded.');
      load();
    }
  };

  const sendReminders = async () => {
    const studentIds = Object.keys(selected).filter(id => selected[id]);
    if (studentIds.length === 0) return;
    const res = await fetch('/api/school/fees/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, student_ids: studentIds, channel: 'email' }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage(`Queued ${json.queued} reminder(s).`);
      setSelected({});
    }
  };

  const statusStyle = {
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid: 'bg-red-100 text-red-700',
    no_fee_set: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Module</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Fee Management</h1>
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

        {/* Fee structures */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <h2 className="font-extrabold text-brand-blue mb-3">Fee Structures for {term}, {session}</h2>
          <div className="space-y-2 mb-4">
            {structures.length === 0 && <p className="text-sm text-slate-400">No fee set for this term yet — add one below.</p>}
            {structures.map(s => (
              <div key={s.id} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                <span>{s.title} {s.class_level ? `(${s.class_level})` : '(all classes)'}</span>
                <span className="font-bold">₦{Number(s.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <form onSubmit={createStructure} className="flex flex-wrap gap-2 items-end">
            <input placeholder="Title" value={newFee.title} onChange={e => setNewFee(v => ({ ...v, title: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-40" />
            <input placeholder="Amount (₦)" type="number" value={newFee.amount} onChange={e => setNewFee(v => ({ ...v, amount: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-32" />
            <input placeholder="Class (optional)" value={newFee.class_level} onChange={e => setNewFee(v => ({ ...v, class_level: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-32" />
            <input type="date" value={newFee.due_date} onChange={e => setNewFee(v => ({ ...v, due_date: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button type="submit" className="rounded-full bg-brand-blue text-white text-sm font-bold px-4 py-2">Add Fee</button>
          </form>
        </div>

        {/* Balances */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-extrabold text-brand-blue">Student Balances</h2>
            <button onClick={sendReminders} className="text-xs font-bold rounded-full px-4 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200">
              🔔 Send reminder to selected
            </button>
          </div>
          {loading ? (
            <p className="p-6 text-slate-500">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    <th className="px-4 py-3"></th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Owed</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Record payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balances.map(b => (
                    <tr key={b.student_id}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={!!selected[b.student_id]} onChange={e => setSelected(prev => ({ ...prev, [b.student_id]: e.target.checked }))} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-brand-dark">{b.full_name}</p>
                        <p className="text-xs text-slate-400">{b.class_level || '—'}</p>
                      </td>
                      <td className="px-4 py-3">₦{b.amount_owed.toLocaleString()}</td>
                      <td className="px-4 py-3">₦{b.amount_paid.toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold">₦{b.balance.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold rounded-full px-3 py-1 ${statusStyle[b.status]}`}>{b.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        {b.fee_structure_id ? (
                          <div className="flex gap-1">
                            <input
                              type="number"
                              placeholder="₦"
                              value={paymentDraft[b.student_id] || ''}
                              onChange={e => setPaymentDraft(prev => ({ ...prev, [b.student_id]: e.target.value }))}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-20"
                            />
                            <button onClick={() => recordPayment(b.student_id, b.fee_structure_id)} className="text-xs font-bold rounded-lg px-2 py-1 bg-green-100 text-green-700">Add</button>
                          </div>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                  {balances.length === 0 && (
                    <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No students found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
