'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadQuizzes() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') { router.push('/login'); return; }

      const { data } = await supabase
        .from('quizzes')
        .select(`
          *,
          profiles: tutor_id (full_name, email)
        `)
        .order('created_at', { ascending: false });

      setQuizzes(data || []);
      setLoading(false);
    }

    loadQuizzes();
  }, [router]);

  const togglePublish = async (id, currentStatus) => {
    const { error } = await supabase
      .from('quizzes')
      .update({ is_published: !currentStatus })
      .eq('id', id);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      setQuizzes(quizzes.map(q => q.id === id ? { ...q, is_published: !currentStatus } : q));
    }
  };

  const deleteQuiz = async (id) => {
    if (!confirm('Delete this quiz and all its questions?')) return;
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      setQuizzes(quizzes.filter(q => q.id !== id));
    }
  };

  if (loading) return <div className="text-center py-20">Loading quizzes...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Manage Quizzes</p>
            <h1 className="text-2xl font-extrabold text-brand-blue mt-1">All Quizzes</h1>
            <p className="text-sm text-gray-500">{quizzes.length} quizzes total</p>
          </div>
          <Link
            href="/tutor/quizzes/new"
            className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90"
          >
            + New Quiz
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        {quizzes.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-4">📝</p>
            <p className="text-gray-500">No quizzes created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Title</th>
                  <th className="px-6 py-4 text-left font-semibold">Tutor</th>
                  <th className="px-6 py-4 text-left font-semibold">Questions</th>
                  <th className="px-6 py-4 text-left font-semibold">Points</th>
                  <th className="px-6 py-4 text-left font-semibold">Status</th>
                  <th className="px-6 py-4 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quizzes.map((quiz) => {
                  const questionCount = quiz.questions?.length || 0;
                  return (
                    <tr key={quiz.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-semibold">{quiz.title}</td>
                      <td className="px-6 py-4">{quiz.profiles?.full_name || quiz.profiles?.email || 'Unknown'}</td>
                      <td className="px-6 py-4">{questionCount}</td>
                      <td className="px-6 py-4">{quiz.points_reward || 10}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${quiz.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {quiz.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 space-x-2">
                        <button
                          onClick={() => togglePublish(quiz.id, quiz.is_published)}
                          className={`text-xs font-bold ${quiz.is_published ? 'text-yellow-600' : 'text-green-600'} hover:underline`}
                        >
                          {quiz.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => deleteQuiz(quiz.id)}
                          className="text-red-500 text-xs font-bold hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}