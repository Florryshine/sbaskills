'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const CLASS_OPTIONS = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];

function genPassword() {
  return Math.random().toString(36).slice(-8) + '!1';
}

export default function ManagePeoplePage() {
  const { slug } = useParams();
  const [me, setMe] = useState(null);
  const [people, setPeople] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const [newPerson, setNewPerson] = useState({ full_name: '', email: '', role: 'student', student_level: '', password: genPassword() });
  const [linkForm, setLinkForm] = useState({ parent_id: '', student_id: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    const [meRes, allRes, linkRes] = await Promise.all([
      fetch(`/api/school/me?school=${slug}`),
      fetch(`/api/school/staff?school=${slug}`),
      fetch(`/api/school/parent-links?school=${slug}`),
    ]);
    if (meRes.ok) setMe((await meRes.json()).profile);
    if (allRes.ok) {
      const json = await allRes.json();
      const list = json.people || [];
      setPeople(list);
      setStudents(list.filter(p => p.role === 'student'));
      setParents(list.filter(p => p.role === 'parent'));
    }
    if (linkRes.ok) setLinks((await linkRes.json()).links || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  const createPerson = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    const res = await fetch('/api/school/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, ...newPerson }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage(`Created ${newPerson.role} account for ${newPerson.full_name}. Temporary password: ${newPerson.password}`);
      setNewPerson({ full_name: '', email: '', role: newPerson.role, student_level: '', password: genPassword() });
      load();
    } else {
      setError(json.error || 'Could not create account.');
    }
  };

  const promoteToPrincipal = async (userId) => {
    setError(null);
    const res = await fetch('/api/school/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, user_id: userId, role: 'principal' }),
    });
    const json = await res.json();
    if (res.ok) { setMessage('Promoted to principal.'); load(); }
    else setError(json.error || 'Could not promote.');
  };

  const linkParent = async (e) => {
    e.preventDefault();
    if (!linkForm.parent_id || !linkForm.student_id) return;
    setError(null);
    const res = await fetch('/api/school/parent-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, ...linkForm }),
    });
    const json = await res.json();
    if (res.ok) { setMessage('Parent linked to child.'); setLinkForm({ parent_id: '', student_id: '' }); load(); }
    else setError(json.error || 'Could not link.');
  };

  const unlink = async (linkId) => {
    setError(null);
    const res = await fetch('/api/school/parent-links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, link_id: linkId }),
    });
    if (res.ok) load();
  };

  const isAdmin = me?.role === 'admin';
  const canCreateRoles = {
    admin: ['teacher', 'principal', 'student', 'parent'],
    principal: ['teacher', 'student', 'parent'],
    teacher: ['student', 'parent'],
  }[me?.role] || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Module</p>
          <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Manage People</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin ? 'Add staff, promote a principal, or manage anyone at this school.' : 'Add the people your role is allowed to add.'}
          </p>
        </div>

        {message && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 break-words">{message}</div>}
        {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

        {canCreateRoles.length > 0 && (
          <form onSubmit={createPerson} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-3">
            <h2 className="font-extrabold text-brand-blue">Add a Person</h2>
            <div className="flex flex-wrap gap-3">
              <input required placeholder="Full name" value={newPerson.full_name} onChange={e => setNewPerson(p => ({ ...p, full_name: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex-1 min-w-[160px]" />
              <input required type="email" placeholder="Email" value={newPerson.email} onChange={e => setNewPerson(p => ({ ...p, email: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex-1 min-w-[160px]" />
              <select value={newPerson.role} onChange={e => setNewPerson(p => ({ ...p, role: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {canCreateRoles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              {newPerson.role === 'student' && (
                <select value={newPerson.student_level} onChange={e => setNewPerson(p => ({ ...p, student_level: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Class</option>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input value={newPerson.password} onChange={e => setNewPerson(p => ({ ...p, password: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-40" />
              <button type="button" onClick={() => setNewPerson(p => ({ ...p, password: genPassword() }))} className="text-xs font-bold text-brand-blue">Regenerate password</button>
            </div>
            <button type="submit" className="rounded-full bg-brand-blue text-white font-bold px-6 py-3">Create Account</button>
          </form>
        )}

        {/* Everyone at the school, with promote-to-principal for admins */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-100">
          <div className="p-5"><h2 className="font-extrabold text-brand-blue">Everyone at this School</h2></div>
          {loading ? <p className="p-6 text-slate-500">Loading...</p> : people.length === 0 ? (
            <p className="p-6 text-center text-slate-500">No one added yet.</p>
          ) : (
            people.map(p => (
              <div key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-brand-dark">{p.full_name} <span className="text-xs font-normal text-slate-400">({p.role}{p.student_level ? `, ${p.student_level}` : ''})</span></p>
                  <p className="text-xs text-slate-400">{p.email}</p>
                </div>
                {isAdmin && p.role !== 'principal' && p.role !== 'admin' && (
                  <button onClick={() => promoteToPrincipal(p.id)} className="text-xs font-bold rounded-full px-3 py-2 bg-amber-100 text-amber-700">
                    Make Principal
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Parent <-> student linking */}
        {canCreateRoles.includes('parent') && (
          <>
            <form onSubmit={linkParent} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-3">
              <h2 className="font-extrabold text-brand-blue">Link a Parent to a Child</h2>
              <div className="flex flex-wrap gap-3">
                <select required value={linkForm.parent_id} onChange={e => setLinkForm(f => ({ ...f, parent_id: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex-1 min-w-[160px]">
                  <option value="">Select parent...</option>
                  {parents.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>)}
                </select>
                <select required value={linkForm.student_id} onChange={e => setLinkForm(f => ({ ...f, student_id: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex-1 min-w-[160px]">
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.student_level || 'no class'})</option>)}
                </select>
              </div>
              <button type="submit" className="rounded-full bg-brand-blue text-white font-bold px-6 py-3">Link</button>
            </form>

            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-100">
              <div className="p-5"><h2 className="font-extrabold text-brand-blue">Parent Links</h2></div>
              {links.length === 0 ? (
                <p className="p-6 text-center text-slate-500">No parents linked yet.</p>
              ) : (
                links.map(l => (
                  <div key={l.id} className="p-4 flex items-center justify-between">
                    <p className="text-sm text-slate-700"><span className="font-bold">{l.parent?.full_name}</span> &rarr; {l.student?.full_name}</p>
                    <button onClick={() => unlink(l.id)} className="text-xs font-bold text-red-500">Remove</button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
