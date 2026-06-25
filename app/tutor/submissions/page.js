'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Submissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadSubmissions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!['tutor', 'admin'].includes(profile?.role)) {
        router.push('/dashboard');
        return;
      }

      const { data } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          assignments(title, tutor_id),
          profiles(full_name, email)
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });

      setSubmissions(data || []);
      setLoading(false);
    }

    loadSubmissions();
  }, [router]);

  const handleGrade = async (submissionId, score, feedback) => {
    if (!score || score < 0) {
      alert('Please enter a valid score');
      return;
    }

    const { error } = await supabase
      .from('assignment_submissions')
      .update({
        score: parseInt(score),
        feedback: feedback || '',
        status: 'graded',
        graded_at: new Date(),
      })
      .eq('id', submissionId);

    if (error) {
      alert('Error grading: ' + error.message);
    } else {
      alert('✅ Graded successfully!');
      setSubmissions(submissions.filter(s => s.id !== submissionId));
    }
  };

  if (loading) return <div className="text-center py-20">Loading submissions...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <Link href="/tutor" className="text-sm text-brand-blue underline">← Back to Dashboard</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">Grade Submissions</h1>
        <p className="text-sm text-gray-500">{submissions.length} pending submissions</p>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
          <p className="text-4xl mb-4">✅</p>
          <p className="text-gray-500">No pending submissions to grade.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white rounded-2xl p-6 shadow-sm border">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800">{sub.assignments?.title}</h3>
                  <p className="text-sm text-gray-500">Student: {sub.profiles?.full_name || sub.profiles?.email}</p>
                  <p className="text-xs text-gray-400">Submitted: {new Date(sub.submitted_at).toLocaleString()}</p>
                  {sub.submission_text && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-xl text-sm">{sub.submission_text}</div>
                  )}
                  {sub.submission_url && (
                    <a href={sub.submission_url} target="_blank" className="text-brand-blue text-sm hover:underline">📎 View Attachment</a>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder="Score"
                    className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    id={`score-${sub.id}`}
                  />
                  <button
                    onClick={() => {
                      const score = document.getElementById(`score-${sub.id}`).value;
                      const feedback = prompt('Feedback (optional):');
                      handleGrade(sub.id, score, feedback);
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:opacity-90"
                  >
                    Grade
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