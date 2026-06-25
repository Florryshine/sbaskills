'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminTestimonials() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadTestimonials() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') { router.push('/login'); return; }

      const { data } = await supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false });

      setTestimonials(data || []);
      setLoading(false);
    }

    loadTestimonials();
  }, [router]);

  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from('testimonials')
      .update({ status, updated_at: new Date() })
      .eq('id', id);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      setTestimonials(testimonials.map(t => t.id === id ? { ...t, status } : t));
      alert('✅ Status updated!');
    }
  };

  const toggleVerified = async (id, current) => {
    const { error } = await supabase
      .from('testimonials')
      .update({ is_verified: !current })
      .eq('id', id);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      setTestimonials(testimonials.map(t => t.id === id ? { ...t, is_verified: !current } : t));
    }
  };

  const deleteTestimonial = async (id) => {
    if (!confirm('Delete this testimonial?')) return;
    const { error } = await supabase
      .from('testimonials')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      setTestimonials(testimonials.filter(t => t.id !== id));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) return <div className="text-center py-20">Loading testimonials...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <Link href="/admin/dashboard" className="text-sm text-brand-blue underline">← Back to Admin</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">Manage Testimonials</h1>
        <p className="text-sm text-gray-500">{testimonials.length} testimonials total</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Student</th>
                <th className="px-6 py-4 text-left font-semibold">Testimonial</th>
                <th className="px-6 py-4 text-left font-semibold">Status</th>
                <th className="px-6 py-4 text-left font-semibold">Verified</th>
                <th className="px-6 py-4 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {testimonials.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold">{t.name}</p>
                    {t.course && <p className="text-xs text-gray-500">{t.course}</p>}
                    <p className="text-xs text-gray-400">{'⭐'.repeat(t.rating || 5)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="max-w-xs truncate">{t.testimonial}</p>
                    {t.proof_url && (
                      <a href={t.proof_url} target="_blank" className="text-brand-blue text-xs hover:underline">📎 Proof</a>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(t.status)}`}>
                      {t.status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleVerified(t.id, t.is_verified)}
                      className={`text-xs font-bold ${t.is_verified ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      {t.is_verified ? '✅ Verified' : 'Mark Verified'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 flex-wrap">
                      {t.status !== 'approved' && (
                        <button
                          onClick={() => updateStatus(t.id, 'approved')}
                          className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold hover:opacity-90"
                        >
                          Approve
                        </button>
                      )}
                      {t.status !== 'rejected' && (
                        <button
                          onClick={() => updateStatus(t.id, 'rejected')}
                          className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold hover:opacity-90"
                        >
                          Reject
                        </button>
                      )}
                      {t.status !== 'pending' && (
                        <button
                          onClick={() => updateStatus(t.id, 'pending')}
                          className="bg-yellow-600 text-white px-3 py-1 rounded-full text-xs font-bold hover:opacity-90"
                        >
                          Pending
                        </button>
                      )}
                      <button
                        onClick={() => deleteTestimonial(t.id)}
                        className="bg-gray-300 text-gray-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-gray-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}