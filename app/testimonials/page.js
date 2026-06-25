'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function TestimonialsPage() {
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    name: '',
    course: '',
    rating: 5,
    testimonial: '',
    proof_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from('testimonials')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      setApproved(data || []);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        setUser(user);
        if (profile?.full_name) {
          setForm(prev => ({ ...prev, name: profile.full_name }));
        }
      }
      setLoading(false);
    }

    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.testimonial) {
      alert('Please write your testimonial');
      return;
    }

    setSubmitting(true);
    const studentId = user?.id || null;

    const { error } = await supabase
      .from('testimonials')
      .insert({
        student_id: studentId,
        name: form.name,
        course: form.course,
        rating: form.rating,
        testimonial: form.testimonial,
        proof_url: form.proof_url,
        status: 'pending',
      });

    if (error) {
      alert('Error submitting: ' + error.message);
    } else {
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="max-w-2xl mx-auto px-4">
            <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
              <p className="text-5xl mb-4">🙏</p>
              <h1 className="text-2xl font-extrabold text-brand-blue">Thank You!</h1>
              <p className="text-gray-600 mt-4">Your testimonial has been submitted for review. Once approved, it will appear on our website.</p>
              <button onClick={() => router.push('/dashboard')} className="mt-6 bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90">
                Back to Dashboard
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-8">
          {/* Submission Form */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h1 className="text-2xl font-extrabold text-brand-blue mb-2">Share Your Experience</h1>
            <p className="text-sm text-gray-500 mb-6">Help other students by sharing your SBA journey.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Course/Class</label>
                <input
                  type="text"
                  value={form.course}
                  onChange={e => setForm({ ...form, course: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2"
                  placeholder="e.g., JAMB Biology, Python Programming"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Rating</label>
                <select
                  value={form.rating}
                  onChange={e => setForm({ ...form, rating: parseInt(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2"
                >
                  <option value="5">⭐⭐⭐⭐⭐ - Excellent</option>
                  <option value="4">⭐⭐⭐⭐ - Good</option>
                  <option value="3">⭐⭐⭐ - Average</option>
                  <option value="2">⭐⭐ - Below Average</option>
                  <option value="1">⭐ - Poor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Your Testimonial *</label>
                <textarea
                  rows="4"
                  required
                  value={form.testimonial}
                  onChange={e => setForm({ ...form, testimonial: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2"
                  placeholder="Share how SBA helped you..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Proof URL (Optional)</label>
                <input
                  type="url"
                  value={form.proof_url}
                  onChange={e => setForm({ ...form, proof_url: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2"
                  placeholder="https://..."
                />
                <p className="text-xs text-gray-400 mt-1">Link to JAMB result, WAEC result, admission letter, etc.</p>
              </div>

              {!user && (
                <p className="text-sm text-yellow-600">
                  ⚠️ You are not logged in. Please <Link href="/login" className="font-bold underline">login</Link> to submit a testimonial.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !user}
                className="w-full bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Testimonial'}
              </button>
            </form>
          </div>

          {/* Approved Testimonials */}
          <div>
            <h2 className="text-xl font-extrabold text-brand-blue mb-4">🌟 What Students Say</h2>
            {loading ? (
              <p className="text-gray-500">Loading testimonials...</p>
            ) : approved.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
                <p className="text-4xl mb-4">💬</p>
                <p className="text-gray-500">No testimonials yet. Be the first!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {approved.map((t) => (
                  <div key={t.id} className="bg-white rounded-2xl shadow-sm border p-4">
                    <div className="flex items-center gap-3">
                      {t.photo ? (
                        <img src={t.photo} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-brand-blue flex items-center justify-center text-white font-bold">
                          {t.name?.charAt(0) || 'S'}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-800">{t.name}</p>
                        {t.course && <p className="text-xs text-gray-500">{t.course}</p>}
                        <p className="text-xs">{'⭐'.repeat(t.rating || 5)}</p>
                      </div>
                      {t.is_verified && (
                        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">✅ Verified</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{t.testimonial}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}