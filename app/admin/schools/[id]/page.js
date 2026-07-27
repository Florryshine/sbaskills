'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

function ActionMenu({ student, onMakeTeacher, onMakePrincipal, onMakeStudent, onToggleActive, onUnassign, schools }) {
  const [open, setOpen] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setShowMove(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="rounded-full h-8 w-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Actions"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-slate-100 bg-white shadow-lg py-1 text-sm">
          {student.role !== 'teacher' && (
            <button onClick={() => { onMakeTeacher(student.id); setOpen(false); }}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
              → Make Teacher
            </button>
          )}
          {student.role !== 'principal' && (
            <button onClick={() => { onMakePrincipal(student.id); setOpen(false); }}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
              → Make Principal
            </button>
          )}
          {student.role !== 'student' && (
            <button onClick={() => { onMakeStudent(student.id); setOpen(false); }}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
              → Make Student
            </button>
          )}
          <div className="border-t border-slate-100 my-1" />
          <button onClick={() => { onToggleActive(student.id, student.is_active); setOpen(false); }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
            → {student.is_active === false ? 'Reactivate' : 'Deactivate'}
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button onClick={() => { onUnassign(student.id); setOpen(false); }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-red-500">
            → Remove from School
          </button>
        </div>
      )}
    </div>
  );
}

export default function ManageSchoolPage() {
  const { id } = useParams();
  const router = useRouter();
  const [school, setSchool] = useState(null);
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [publicUrl, setPublicUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPublicUrl(`${window.location.origin}/school/`);
    }
  }, []);

  async function loadData() {
    const supabase = createBrowserClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/admin/login'); return; }
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') { router.push('/login'); return; }

    const { data: schoolData } = await supabase
      .from('schools')
      .select('*')
      .eq('id', id)
      .single();
    setSchool(schoolData);

    const { data: assigned } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_teaching, is_active')
      .eq('school_id', id)
      .order('full_name');
    setAssignedStudents(assigned || []);

    const { data: unassigned } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .is('school_id', null)
      .eq('role', 'student')
      .order('full_name')
      .limit(100);
    setUnassignedStudents(unassigned || []);

    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id]);

  async function assignStudent(studentId) {
    const supabase = createBrowserClient();
    await supabase.from('profiles').update({ school_id: id }).eq('id', studentId);
    loadData();
  }

  async function unassignStudent(studentId) {
    const supabase = createBrowserClient();
    await supabase.from('profiles').update({ school_id: null }).eq('id', studentId);
    loadData();
  }

  async function makePrincipal(studentId) {
    if (!confirm('Give this person principal access to this school?')) return;
    const supabase = createBrowserClient();
    await supabase.from('profiles').update({ role: 'principal', school_id: id }).eq('id', studentId);
    loadData();
  }

  async function makeTeacher(studentId) {
    if (!confirm('Give this person teacher access to this school?')) return;
    const supabase = createBrowserClient();
    await supabase.from('profiles').update({ role: 'teacher', school_id: id }).eq('id', studentId);
    loadData();
  }

  async function makeStudent(studentId) {
    if (!confirm('Change this person back to a regular student?')) return;
    const supabase = createBrowserClient();
    await supabase.from('profiles').update({ role: 'student' }).eq('id', studentId);
    loadData();
  }

  async function toggleActive(studentId, currentlyActive) {
    const nowActive = currentlyActive === false; // if currently inactive, reactivate
    const supabase = createBrowserClient();
    await supabase.from('profiles').update({ is_active: nowActive }).eq('id', studentId);
    loadData();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  if (!school) return (
    <div className="max-w-md mx-auto mt-20 text-center text-slate-500">School not found.</div>
  );

  const schoolPageUrl = `${publicUrl}${school.slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(schoolPageUrl)}`;

  const filteredUnassigned = unassignedStudents.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
              Manage School
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">{school.name}</h1>
            <p className="mt-1 text-sm text-slate-500">/school/{school.slug}</p>
          </div>
          <Link href="/admin/schools" className="text-sm font-semibold text-brand-blue hover:underline">
            ← Back to Schools
          </Link>
        </div>
      </section>

      {/* QR Code + links */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h2 className="font-extrabold text-brand-blue mb-4">School Page & QR Code</h2>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="shrink-0 rounded-xl border border-slate-100 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={`QR code for ${school.name}`} width={160} height={160} />
          </div>
          <div className="space-y-3 flex-1">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Public School Page</p>
              <a href={schoolPageUrl} target="_blank" rel="noreferrer"
                className="text-brand-blue font-semibold hover:underline break-all">
                {schoolPageUrl}
              </a>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Principal Dashboard</p>
              <a href={`${schoolPageUrl}/principal`} target="_blank" rel="noreferrer"
                className="text-brand-blue font-semibold hover:underline break-all">
                {schoolPageUrl}/principal
              </a>
            </div>
            <a href={qrUrl} download={`${school.slug}-qr.png`}
              className="inline-block rounded-full bg-brand-yellow text-brand-dark px-4 py-2 text-sm font-bold hover:opacity-90">
              Download QR Code
            </a>
          </div>
        </div>
      </section>

      {/* Assigned students / staff */}
      <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="font-extrabold text-brand-blue">
            Assigned to {school.name} ({assignedStudents.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignedStudents.length > 0 ? assignedStudents.map(s => (
                <tr key={s.id} className={`hover:bg-slate-50 ${s.is_active === false ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-3">
                    <p className="font-bold text-brand-dark">{s.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-slate-400">{s.email}</p>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        s.role === 'principal' ? 'bg-purple-100 text-purple-700'
                        : s.role === 'teacher' ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                      }`}>
                        {s.role}
                      </span>
                      {s.is_active === false && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-red-50 text-red-500">
                          inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <ActionMenu
                      student={s}
                      onMakeTeacher={makeTeacher}
                      onMakePrincipal={makePrincipal}
                      onMakeStudent={makeStudent}
                      onToggleActive={toggleActive}
                      onUnassign={unassignStudent}
                    />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-500">
                    No one assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Assign students */}
      <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 space-y-3">
          <h2 className="font-extrabold text-brand-blue">Assign Students</h2>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search unassigned students by name or email..."
            className="w-full max-w-md rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-blue"
          />
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {filteredUnassigned.length > 0 ? filteredUnassigned.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <p className="font-bold text-brand-dark">{s.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-slate-400">{s.email}</p>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => assignStudent(s.id)}
                      className="rounded-full bg-brand-blue text-white px-4 py-1.5 text-xs font-bold hover:opacity-90">
                      Assign
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="2" className="px-6 py-8 text-center text-slate-500">
                    No unassigned students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
