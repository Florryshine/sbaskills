'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/login'); return; }

      const { data: schoolRows } = await supabase
        .from('schools')
        .select('id, slug, name, principal_name, is_published, created_at')
        .order('created_at', { ascending: false });

      const schoolIds = (schoolRows || []).map(s => s.id);
      let counts = {};
      if (schoolIds.length > 0) {
        const { data: studentRows } = await supabase
          .from('profiles')
          .select('school_id')
          .eq('role', 'student')
          .in('school_id', schoolIds);
        (studentRows || []).forEach(r => {
          counts[r.school_id] = (counts[r.school_id] || 0) + 1;
        });
      }

      setSchools((schoolRows || []).map(s => ({ ...s, studentCount: counts[s.id] || 0 })));
      setLoading(false);
    }
    load();
  }, [router]);

  async function togglePublish(school) {
    const supabase = createBrowserClient();
    await supabase
      .from('schools')
      .update({ is_published: !school.is_published })
      .eq('id', school.id);
    setSchools(prev =>
      prev.map(s => s.id === school.id ? { ...s, is_published: !s.is_published } : s)
    );
  }

  async function deleteSchool(id) {
    if (!confirm('Delete this school? Students linked to it will be unlinked, not deleted.')) return;
    const supabase = createBrowserClient();
    await supabase.from('schools').delete().eq('id', id);
    setSchools(prev => prev.filter(s => s.id !== id));
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-500">Loading schools...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
              Management
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Schools</h1>
            <p className="mt-1 text-sm text-slate-500">{schools.length} schools on the platform</p>
          </div>
          <Link href="/admin/schools/new"
            className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm
                       font-bold text-brand-dark hover:opacity-90 transition">
            + Add School
          </Link>
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        {schools.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">School</th>
                  <th className="px-6 py-4 font-semibold">Principal</th>
                  <th className="px-6 py-4 font-semibold">Students</th>
                  <th className="px-6 py-4 font-semibold">Page</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schools.map(school => (
                  <tr key={school.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-brand-blue">{school.name}</p>
                      <p className="text-xs text-slate-400">/school/{school.slug}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{school.principal_name || '—'}</td>
                    <td className="px-6 py-4 font-bold text-brand-dark">{school.studentCount}</td>
                    <td className="px-6 py-4">
                      <Link href={`/school/${school.slug}`} target="_blank"
                        className="text-brand-blue font-semibold hover:underline">
                        View →
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => togglePublish(school)}
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          school.is_published
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                        {school.is_published ? 'Published' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <Link href={`/admin/schools/${school.id}`}
                          className="text-brand-blue font-semibold hover:underline">
                          Manage
                        </Link>
                        <button onClick={() => deleteSchool(school.id)}
                          className="text-red-500 font-semibold hover:underline">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-slate-500">
            No schools yet.{' '}
            <Link href="/admin/schools/new" className="text-brand-blue font-semibold hover:underline">
              Add your first one →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
