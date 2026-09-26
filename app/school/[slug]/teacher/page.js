'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function SchoolTeacherDashboard() {
  const { slug } = useParams();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [observations, setObservations] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [teacherAttendance, setTeacherAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const meRes = await fetch('/api/school/me?school=' + encodeURIComponent(slug));
    const meJson = await meRes.json();
    if (!meRes.ok || !meJson.profile) { router.push('/login'); return; }
    if (meJson.profile.role === 'principal' || meJson.profile.role === 'admin') {
      router.replace('/school/' + slug + '/principal');
      return;
    }
    if (meJson.profile.role !== 'teacher' || !meJson.matchesSchool) {
      setError('This dashboard is only available to teachers assigned to this school.');
      setLoading(false);
      return;
    }

    setMe(meJson.profile);
    setSchool(meJson.school);
    const classes = Array.isArray(meJson.profile.assigned_classes) ? meJson.profile.assigned_classes : [];

    const attendanceResults = await Promise.all(
      classes.map(cls => fetch('/api/school/attendance?school=' + encodeURIComponent(slug) + '&class=' + encodeURIComponent(cls)).then(r => r.json()))
    );
    setStudents(attendanceResults.flatMap(r => r.students || []));

    const [obsRes, timeRes, taRes, annRes] = await Promise.all([
      fetch('/api/school/observations?school=' + encodeURIComponent(slug) + '&limit=8'),
      fetch('/api/school/timetable?school=' + encodeURIComponent(slug)),
      fetch('/api/school/teacher-attendance?school=' + encodeURIComponent(slug)),
      fetch('/api/school/announcements?school=' + encodeURIComponent(slug) + '&limit=5'),
    ]);
    const [obsJson, timeJson, taJson, annJson] = await Promise.all([obsRes.json(), timeRes.json(), taRes.json(), annRes.json()]);

    setObservations(obsJson.observations || []);
    setTimetable(timeJson.slots || []);
    setTeacherAttendance((taJson.records || []).find(r => r.teacher_id === meJson.profile.id) || null);
    setAnnouncements(annJson.announcements || []);
    setLoading(false);
  };

  useEffect(() => { if (slug) load(); }, [slug]);

  const classCounts = useMemo(() => {
    const counts = {};
    students.forEach(s => { counts[s.student_level] = (counts[s.student_level] || 0) + 1; });
    return counts;
  }, [students]);

  const summary = useMemo(() => ({
    marked: students.filter(s => s.status).length,
    present: students.filter(s => s.status === 'present').length,
    late: students.filter(s => s.status === 'late').length,
    absent: students.filter(s => s.status === 'absent').length,
  }), [students]);

  const act = async action => {
    setError('');
    const res = await fetch('/api/school/teacher-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: slug, action }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || 'Could not update check-in.'); return; }
    load();
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Loading teacher dashboard...</p></div>;
  if (error && !me) return <div className="max-w-md mx-auto mt-20 rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center"><p className="font-semibold text-red-600">{error}</p></div>;

  const checkedIn = !!teacherAttendance?.check_in_at;
  const checkedOut = !!teacherAttendance?.check_out_at;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School Teacher</p>
              <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">{school?.name || 'School'}</h1>
              <p className="mt-1 text-sm text-slate-500">Welcome, {me?.full_name || 'Teacher'}.</p>
            </div>
            <button onClick={() => act(checkedIn ? 'check_out' : 'check_in')} disabled={checkedIn && checkedOut} className="rounded-full bg-brand-blue text-white px-4 py-2 text-sm font-bold disabled:opacity-50">
              {checkedIn ? (checkedOut ? 'Checked out' : 'Check out') : 'Check in'}
            </button>
          </div>
          {error && <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm"><p className="text-2xl font-extrabold text-brand-blue">{students.length}</p><p className="text-xs text-slate-500 mt-1">My students</p></div>
          <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm"><p className="text-2xl font-extrabold text-purple-600">{Object.keys(classCounts).length}</p><p className="text-xs text-slate-500 mt-1">My classes</p></div>
          <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm"><p className="text-2xl font-extrabold text-green-600">{summary.present}</p><p className="text-xs text-slate-500 mt-1">Present today</p></div>
          <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm"><p className="text-2xl font-extrabold text-red-600">{summary.absent}</p><p className="text-xs text-slate-500 mt-1">Absent today</p></div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">My classes</p>
            <h2 className="mt-1 font-extrabold text-brand-blue">Assigned classes</h2>
            {me?.assigned_classes?.length ? <div className="mt-4 flex flex-wrap gap-2">{me.assigned_classes.map(c => <span key={c} className="rounded-full bg-blue-50 text-brand-blue px-3 py-1.5 text-sm font-bold">{c} · {classCounts[c] || 0} students</span>)}</div> : <p className="mt-4 text-sm text-slate-500">No classes assigned yet. Ask your principal to assign your classes.</p>}
          </div>
          <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Today</p><h2 className="mt-1 font-extrabold text-brand-blue">Attendance</h2></div><a href={'/school/' + slug + '/attendance'} className="text-xs font-bold text-brand-blue">Open →</a></div>
            <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-green-50 p-3 text-center"><p className="font-extrabold text-green-700">{summary.present}</p><p className="text-[11px] text-slate-500">Present</p></div><div className="rounded-xl bg-amber-50 p-3 text-center"><p className="font-extrabold text-amber-700">{summary.late}</p><p className="text-[11px] text-slate-500">Late</p></div><div className="rounded-xl bg-red-50 p-3 text-center"><p className="font-extrabold text-red-700">{summary.absent}</p><p className="text-[11px] text-slate-500">Absent</p></div></div>
            <p className="mt-3 text-xs text-slate-400">{summary.marked} of {students.length} students marked today.</p>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">My timetable</p>
            <h2 className="mt-1 font-extrabold text-brand-blue">Teaching schedule</h2>
            {timetable.length ? <div className="mt-4 space-y-2">{timetable.slice(0, 6).map(s => <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"><div><p className="text-sm font-bold text-brand-dark">{s.subject}</p><p className="text-xs text-slate-400">{s.class_level}</p></div><span className="text-xs font-bold text-slate-600">{String(s.start_time).slice(0,5)}–{String(s.end_time).slice(0,5)}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No timetable slots assigned to you yet.</p>}
          </div>
          <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Student notes</p>
            <h2 className="mt-1 font-extrabold text-brand-blue">Recent observations</h2>
            {observations.length ? <div className="mt-4 space-y-3">{observations.slice(0,5).map(o => <div key={o.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-brand-dark">{o.profiles?.full_name || 'Student'}</p><span className="text-[11px] text-slate-400">{new Date(o.date).toLocaleDateString('en-NG',{day:'numeric',month:'short'})}</span></div><p className="text-xs text-slate-500 mt-1">{o.status?.replace(/_/g,' ')}{o.note ? ' · ' + o.note : ''}</p></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No observations yet.</p>}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Quick actions</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={'/school/' + slug + '/attendance'} className="rounded-full bg-brand-blue text-white px-4 py-2 text-sm font-bold">Take attendance</a>
            <a href={'/school/' + slug + '/observations'} className="rounded-full bg-slate-100 text-slate-700 px-4 py-2 text-sm font-bold">Log observation</a>
            <a href={'/school/' + slug + '/teacher-attendance'} className="rounded-full bg-slate-100 text-slate-700 px-4 py-2 text-sm font-bold">My check-in</a>
            <a href={'/school/' + slug + '/report-cards'} className="rounded-full bg-slate-100 text-slate-700 px-4 py-2 text-sm font-bold">Report cards</a>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">School notices</p>
          {announcements.length ? <div className="mt-3 space-y-3">{announcements.slice(0,4).map(a => <div key={a.id}><p className="text-sm font-bold text-brand-dark">{a.title}</p><p className="text-xs text-slate-500 mt-1">{a.message}</p></div>)}</div> : <p className="mt-3 text-sm text-slate-500">No announcements yet.</p>}
        </section>
      </div>
    </div>
  );
}