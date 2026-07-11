'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TutorActivityPage() {
  const [tab, setTab] = useState('assignments');
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/admin/login'); return; }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') { router.push('/login'); return; }

    const { data: assignmentsData } = await supabase
      .from('assignments')
      .select('*, profiles: tutor_id (full_name, email)')
      .order('created_at', { ascending: false });
    setAssignments(assignmentsData || []);

    const { data: materialsData } = await supabase
      .from('tutor_materials')
      .select('*, profiles: tutor_id (full_name, email)')
      .order('created_at', { ascending: false });
    setMaterials(materialsData || []);

    setLoading(false);
  };

  const deleteAssignment = async (id) => {
    if (!confirm('Delete this assignment? Student submissions against it will also be removed.')) return;
    await supabase.from('assignments').delete().eq('id', id);
    loadAll();
  };

  const deleteMaterial = async (id) => {
    if (!confirm('Delete this material?')) return;
    await supabase.from('tutor_materials').delete().eq('id', id);
    loadAll();
  };

  if (loading) return <div className="text-center py-20">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-blue">👩‍🏫 Tutor Activity</h1>
        <p className="text-sm text-gray-500">Monitor and moderate everything tutors have created.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('assignments')} className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'assignments' ? 'bg-brand-blue text-white' : 'bg-white border text-gray-600'}`}>
          📄 Assignments ({assignments.length})
        </button>
        <button onClick={() => setTab('materials')} className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'materials' ? 'bg-brand-blue text-white' : 'bg-white border text-gray-600'}`}>
          📁 Materials ({materials.length})
        </button>
        <Link href="/admin/quizzes" className="px-4 py-2 rounded-xl text-sm font-bold bg-white border text-gray-600 hover:bg-gray-50">
          🧠 Quizzes →
        </Link>
        <Link href="/admin/boss-battles" className="px-4 py-2 rounded-xl text-sm font-bold bg-white border text-gray-600 hover:bg-gray-50">
          👹 Boss Battles →
        </Link>
        <Link href="/admin/submissions" className="px-4 py-2 rounded-xl text-sm font-bold bg-white border text-gray-600 hover:bg-gray-50">
          📊 Submissions →
        </Link>
      </div>

      {tab === 'assignments' && (
        <div className="bg-white rounded-2xl shadow-sm border divide-y">
          {assignments.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No assignments created yet.</div>
          ) : assignments.map((a) => (
            <div key={a.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-bold">{a.title}</p>
                <p className="text-sm text-gray-500">
                  By {a.profiles?.full_name || a.profiles?.email || 'Unknown tutor'} • {a.subject || 'No subject'}
                  {a.due_date && ` • Due ${new Date(a.due_date).toLocaleDateString()}`}
                </p>
              </div>
              <button onClick={() => deleteAssignment(a.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-100">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'materials' && (
        <div className="bg-white rounded-2xl shadow-sm border divide-y">
          {materials.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No materials uploaded yet.</div>
          ) : materials.map((m) => (
            <div key={m.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-bold">{m.title}</p>
                <p className="text-sm text-gray-500">
                  By {m.profiles?.full_name || m.profiles?.email || 'Unknown tutor'} • {m.subject || 'No subject'} • {m.file_type || 'file'}
                </p>
              </div>
              <div className="flex gap-2">
                {m.file_url && (
                  <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="bg-blue-50 text-brand-blue px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-100">
                    View
                  </a>
                )}
                <button onClick={() => deleteMaterial(m.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-100">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}