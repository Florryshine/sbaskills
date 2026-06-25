'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminRoles() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadUsers() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') { router.push('/login'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, created_at')
        .order('created_at', { ascending: false });

      setUsers(data || []);
      setLoading(false);
    }

    loadUsers();
  }, [router]);

  const updateRole = async (userId, newRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      alert('✅ Role updated successfully!');
    }
  };

  if (loading) return <div className="text-center py-20">Loading users...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <Link href="/admin/dashboard" className="text-sm text-brand-blue underline">← Back to Admin</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">Manage User Roles</h1>
        <p className="text-sm text-gray-500">{users.length} total users</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">User</th>
                <th className="px-6 py-4 text-left font-semibold">Email</th>
                <th className="px-6 py-4 text-left font-semibold">Current Role</th>
                <th className="px-6 py-4 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold">{u.full_name || 'Unnamed'}</td>
                  <td className="px-6 py-4">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      u.role === 'admin' ? 'bg-red-100 text-red-700' :
                      u.role === 'tutor' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {u.role || 'student'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      defaultValue={u.role || 'student'}
                      className="rounded-xl border border-slate-200 px-3 py-1 text-sm"
                    >
                      <option value="student">Student</option>
                      <option value="tutor">Tutor</option>
                      <option value="admin">Admin</option>
                    </select>
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