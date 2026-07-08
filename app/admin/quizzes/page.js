'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quiz_drafts')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setQuizzes(data || []);
    }
    setLoading(false);
  };

  const deleteQuiz = async (id) => {
    if (!confirm('Delete this quiz?')) return;
    const { error } = await supabase.from('quiz_drafts').delete().eq('id', id);
    if (error) alert(error.message);
    else loadQuizzes();
  };

  const unpublishQuiz = async (id) => {
    if (!confirm('Unpublish this quiz?')) return;
    const { error } = await supabase
      .from('quiz_drafts')
      .update({ status: 'draft' })
      .eq('id', id);
    if (error) alert(error.message);
    else loadQuizzes();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-6">📝 Published Quizzes</h1>
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No published quizzes found.</div>
      ) : (
        <div className="grid gap-4">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{quiz.keyword}</h3>
                  <p className="text-sm text-gray-500">
                    Questions: {quiz.questions?.length || 0} • Published: {new Date(quiz.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/quizzes/${quiz.id}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => unpublishQuiz(quiz.id)}
                    className="text-yellow-600 hover:underline text-sm"
                  >
                    Unpublish
                  </button>
                  <button
                    onClick={() => deleteQuiz(quiz.id)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}