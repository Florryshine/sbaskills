import { requireAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default async function AdminStudentsPage() {
  await requireAdmin();

  const { data: students } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      phone,
      created_at,
      enrollments (id, amount_paid, courses (title))
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">

      {/* Header */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Students</p>
            <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Registered Students</h1>
            <p className="mt-1 text-sm text-slate-500">{students?.length || 0} students registered</p>
          </div>
        </div>

        {/* Search - client-side would need a Client Component; for now it's visual */}
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            placeholder="Search by name or email..."
            className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <button className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90 transition">
            Search
          </button>
        </div>
      </section>

      {/* Students Table */}
      <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">

        {/* Table Header */}
        <div className="hidden grid-cols-4 gap-4 border-b border-slate-100 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 sm:grid">
          <span>Student</span>
          <span>Contact</span>
          <span>Enrolled Courses</span>
          <span>Joined</span>
        </div>

        {students && students.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {students.map((student) => (
              <div key={student.id} className="grid gap-2 px-6 py-4 hover:bg-slate-50 transition sm:grid-cols-4 sm:gap-4 sm:items-center">

                {/* Name */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white text-sm font-extrabold">
                    {(student.full_name || student.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{student.full_name || 'No name'}</p>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Student</p>
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <p className="text-sm text-slate-600 break-all">{student.email}</p>
                  {student.phone && <p className="text-xs text-slate-400 mt-0.5">{student.phone}</p>}
                </div>

                {/* Enrollments */}
                <div>
                  {student.enrollments && student.enrollments.length > 0 ? (
                    <div className="space-y-1">
                      {student.enrollments.slice(0, 2).map((e) => (
                        <span key={e.id} className="block rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-brand-blue truncate">
                          {e.courses?.title || 'Course'}
                        </span>
                      ))}
                      {student.enrollments.length > 2 && (
                        <span className="text-xs text-slate-400">+{student.enrollments.length - 2} more</span>
                      )}
                    </div>
                  ) : (
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-400">No enrollments</span>
                  )}
                </div>

                {/* Joined date */}
                <div className="text-sm text-slate-500">
                  {new Date(student.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-4xl">👥</p>
            <h3 className="mt-4 text-lg font-bold text-slate-700">No students yet</h3>
            <p className="mt-2 text-sm text-slate-400">Students will appear here after they register.</p>
          </div>
        )}
      </section>

    </div>
  );
    }
    
