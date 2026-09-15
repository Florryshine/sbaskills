'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function MyPayslipsPage() {
  const { slug } = useParams();
  const [payslips, setPayslips] = useState([]); const [error, setError] = useState('');
  useEffect(() => { if (!slug) return; fetch(`/api/school/payroll/payslips?school=${slug}`).then(async response => { const json = await response.json(); if (!response.ok) setError(json.error || 'Could not load payslips.'); else setPayslips(json.payslips || []); }); }, [slug]);
  return <main className="min-h-screen bg-slate-50"><div className="max-w-4xl mx-auto px-4 py-10"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Staff portal</p><h1 className="mt-1 text-2xl font-extrabold text-brand-blue">My Payslips</h1></div><a href={`/school/${slug}/principal`} className="text-sm font-bold text-brand-blue">Back</a></div>{error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</p>}<section className="mt-6 rounded-2xl bg-white border border-slate-100 shadow-sm divide-y divide-slate-100">{payslips.length === 0 ? <p className="p-6 text-sm text-slate-500">No payslips are available for your account yet.</p> : payslips.map(slip => <div key={slip.id} className="p-5 flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-brand-dark">{slip.payroll_run?.month ? new Date(slip.payroll_run.month).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) : 'Payroll'}</p><p className="text-sm text-slate-500">Net pay ₦{Number(slip.net_pay).toLocaleString('en-NG')} · {slip.payroll_run?.status}</p></div><a href={`/api/school/payroll/payslip/${slip.id}/pdf`} className="rounded-full bg-brand-blue px-4 py-2 text-xs font-bold text-white">Download PDF</a></div>)}</section></div></main>;
}
