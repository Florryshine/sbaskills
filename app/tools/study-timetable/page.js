'use client';

import { useState } from 'react';
import { askMentor } from '@/lib/mentorBot';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function StudyTimetablePage() {
  const [subjects, setSubjects] = useState('');
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState('4');
  const [currentLevel, setCurrentLevel] = useState('ss3');
  const [loading, setLoading] = useState(false);
  const [timetable, setTimetable] = useState('');
  const [error, setError] = useState('');

  const generateTimetable = async (e) => {
    e.preventDefault();
    if (!subjects.trim()) {
      alert('Please enter at least one subject.');
      return;
    }
    if (!examDate) {
      alert('Please select your exam date.');
      return;
    }

    setLoading(true);
    setError('');
    setTimetable('');

    const subjectList = subjects.split(',').map(s => s.trim()).filter(Boolean);

    const prompt = `Create a detailed, daily study timetable for a ${currentLevel} student preparing for an exam on ${examDate}. 
    Subjects: ${subjectList.join(', ')}. 
    Study hours per day: ${dailyHours} hours.
    
    Please create a day-by-day plan for the next 30 days or until the exam date. Include:
    - Daily schedule with specific subjects and topics
    - Break times
    - Revision days
    - Mock test days
    
    Make it practical and encouraging. Format it clearly with days as headings.`;

    try {
      const response = await askMentor(prompt);
      setTimetable(response);
    } catch (err) {
      setError('Could not generate timetable. Please try again later.');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-extrabold text-brand-blue">
                📅 Study Timetable Generator
              </h1>
              <p className="text-gray-600 mt-2">
                Get a personalized study timetable from Mentor Florryshine based on your subjects and exam date.
              </p>
            </div>

            <form onSubmit={generateTimetable} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Subjects (comma-separated) *
                </label>
                <input
                  type="text"
                  required
                  value={subjects}
                  onChange={(e) => setSubjects(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2"
                  placeholder="e.g., Mathematics, English, Biology, Chemistry, Physics"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Exam Date *
                </label>
                <input
                  type="date"
                  required
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Hours per day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={dailyHours}
                    onChange={(e) => setDailyHours(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Current Level
                  </label>
                  <select
                    value={currentLevel}
                    onChange={(e) => setCurrentLevel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2"
                  >
                    <option value="ss1">SS1</option>
                    <option value="ss2">SS2</option>
                    <option value="ss3">SS3</option>
                    <option value="university">University Student</option>
                    <option value="post_utme">Post-UTME Candidate</option>
                    <option value="jamb">JAMB Candidate</option>
                    <option value="waec">WAEC Candidate</option>
                    <option value="neco">NECO Candidate</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Timetable'}
              </button>
            </form>

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {timetable && (
              <div className="mt-8 bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6">
                <h2 className="text-xl font-extrabold text-brand-blue mb-4">
                  📋 Your Personalized Study Timetable
                </h2>
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed prose max-w-none">
                  {timetable}
                </div>
                <div className="mt-4 text-sm text-gray-500 border-t pt-4">
                  <p>💡 Powered by Mentor Florryshine</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}