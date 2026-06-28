'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { generateAIReport } from '@/lib/groqAPI';

export default function ReportCardPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const { id } = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadReport() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: reportData } = await supabase
        .from('report_cards')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!reportData) {
        setLoading(false);
        return;
      }

      setReport(reportData);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', reportData.student_id)
        .single();
      setStudent(profile);

      setLoading(false);
    }

    loadReport();
  }, [id]);

  const getPerformanceColor = (performance) => {
    const map = {
      'excellent': 'text-green-600',
      'good': 'text-blue-600',
      'average': 'text-yellow-600',
      'poor': 'text-red-600',
    };
    return map[performance] || 'text-gray-600';
  };

  const getPerformanceEmoji = (performance) => {
    const map = {
      'excellent': '🌟',
      'good': '⭐',
      'average': '📊',
      'poor': '💪',
    };
    return map[performance] || '📋';
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
        </div>
        <Footer />
      </>
    );
  }

  if (!report) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center flex-col p-4">
          <p className="text-4xl mb-4">📋</p>
          <h1 className="text-2xl font-bold text-brand-blue">Report Card Not Found</h1>
          <Link href="/dashboard" className="mt-4 bg-brand-yellow px-6 py-3 rounded-full font-bold">Back to Dashboard</Link>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-brand-blue">📊 AI Report Card</h1>
                <p className="text-gray-500 text-sm">
                  {student?.full_name || 'Student'} • {new Date(report.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-extrabold text-brand-blue">
                  {report.score}/{report.total_questions}
                </span>
                <p className="text-sm text-gray-500">
                  {Math.round((report.score / report.total_questions) * 100)}% • {report.activity_type}
                </p>
              </div>
            </div>
          </div>

          {/* Performance Badge */}
          <div className={`bg-white rounded-2xl shadow-sm border p-6 mb-6 text-center ${getPerformanceColor(report.performance)}`}>
            <span className="text-5xl block mb-2">{getPerformanceEmoji(report.performance)}</span>
            <h2 className="text-2xl font-bold capitalize">{report.performance}</h2>
            <p className="text-sm opacity-75">Performance Level</p>
          </div>

          {/* Strengths */}
          {report.strengths?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
              <h3 className="font-bold text-green-600 mb-3">✅ Strengths</h3>
              <ul className="space-y-2">
                {report.strengths.map((item, i) => (
                  <li key={i} className="text-gray-700 text-sm flex items-center gap-2">
                    <span className="text-green-500">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {report.weaknesses?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
              <h3 className="font-bold text-red-600 mb-3">⚠️ Areas for Improvement</h3>
              <ul className="space-y-2">
                {report.weaknesses.map((item, i) => (
                  <li key={i} className="text-gray-700 text-sm flex items-center gap-2">
                    <span className="text-red-500">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Feedback */}
          {report.ai_feedback && (
            <div className="bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6 mb-4">
              <h3 className="font-bold text-brand-blue mb-3">🤖 AI Coach Says</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{report.ai_feedback}</p>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
              <h3 className="font-bold text-brand-blue mb-3">📚 Recommended Next Steps</h3>
              <ul className="space-y-2">
                {report.recommendations.map((item, i) => (
                  <li key={i} className="text-gray-700 text-sm flex items-center gap-2">
                    <span className="text-brand-blue">→</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/dashboard" className="bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}