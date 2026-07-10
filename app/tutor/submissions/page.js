'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

export default function TutorSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => { loadSubmissions(); }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Only assignments belonging to THIS tutor (RLS also enforces this)
    const { data: myAssignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('tutor_id', user.id);

    const assignmentIds = (myAssignments || []).map((a) => a.id);
    if (assignmentIds.length === 0) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('assignment_submissions')
      .select('*, assignments(title), profiles: student_id (full_name, email)')
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false });

    setSubmissions(data || []);
    setLoading(false);
  };

  const handleGrade = async (submissionId, score, feedback) => {
    if (!score || score < 0) {
      alert('Please enter a valid score.');
      return;
    }

    const { error } = await supabase
      .from('assignment_submissions')
      .update({ score: parseInt(score), feedback: feedback || '', status: 'graded', graded_at: new Date() })
      .eq('id', submissionId);

    if (error) {
      alert('Error grading: ' + error.message);
    } else {
      alert('✅ Graded successfully!');
      setSubmissions(submissions.map((s) => s.id === submissionId ? { ...s, status: 'graded', score: parseInt(score), feedback } : s));
    }
  };

  if (loading) return <div className="text-center py-20">Loading submissions...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <Link href="/tutor" className="text-sm text-brand-blue underline">← Back to Tutor Dashboard</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">📊 Submissions</h1>
        <p className="text-sm text-gray-500">{submissions.length} submissions to your assignments</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        {submissions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-gray-500">No submissions yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Student</th>
                  <th className="px-6 py-4 text-left font-semibold">Assignment</th>
                  <th className="px-6 py-4 text-left font-semibold">Submitted</th>
                  <th className="px-6 py-4 text-left font-semibold">Score</th>
                  <th className="px-6 py-4 text-left font-semibold">Status</th>
                  <th className="px-6 py-4 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold">{sub.profiles?.full_name || sub.profiles?.email || 'Unknown'}</td>
                    <td className="px-6 py-4">{sub.assignments?.title || 'Untitled'}</td>
                    <td className="px-6 py-4">{new Date(sub.submitted_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">{sub.score ?? '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${sub.status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {sub.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {sub.status !== 'graded' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Score"
                            className="w-16 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                            id={`score-${sub.id}`}
                          />
                          <button
                            onClick={() => {
                              const score = document.getElementById(`score-${sub.id}`).value;
                              const feedback = prompt('Feedback (optional):');
                              handleGrade(sub.id, score, feedback);
                            }}
                            className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold hover:opacity-90"
                          >
                            Grade
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Graded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}