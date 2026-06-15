import { requireAdmin } from '@/lib/auth';

export default async function AdminStudentsPage({ searchParams }) {
  const { supabase } = await requireAdmin();
  const search = searchParams?.search || '';

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, created_at, enrollments(course_id, courses(title))')
    .eq('role', 'student')
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: students } = await query;

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Students</p>
        <h1 className="mt-3 text-3xl font-bold text-brand-blue">Registered students</h1>
        <form className="mt-6 max-w-xl">
          <label className="mb-2 block text-sm font-semibold text-slate-700">Search by name or email</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              name="search"
              defaultValue={search}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              placeholder="Search students"
            />
            <button type="submit" className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-bold text-brand-dark">
              Search
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[2rem] bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Student</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Enrolled Courses</th>
                <th className="px-6 py-4 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(students || []).map((student) => (
                <tr key={student.id}>
                  <td className="px-6 py-5">
                    <p className="font-bold text-brand-blue">{student.full_name || 'Unnamed Student'}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{student.role}</p>
                  </td>
                  <td className="px-6 py-5 text-slate-600">
                    <p>{student.email}</p>
                    <p>{student.phone || 'No phone'}</p>
                  </td>
                  <td className="px-6 py-5 text-slate-600">
                    <div className="flex flex-wrap gap-2">
                      {(student.enrollments || []).length ? (
                        student.enrollments.map((enrollment, index) => (
                          <span key={`${student.id}-${index}`} className="rounded-full bg-brand-yellow/20 px-3 py-1 text-xs font-bold text-brand-dark">
                            {enrollment.courses?.title || 'Course'}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">No enrollments</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-600">{new Date(student.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {!(students || []).length ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                    No students found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
