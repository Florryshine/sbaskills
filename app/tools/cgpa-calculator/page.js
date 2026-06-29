import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = generateToolMetadata(toolsSEO['cgpa-calculator']);

// ─── Client Component ──────────────────────────────────────
'use client';

import { useState } from 'react';

function Calculator() {
  const [semesters, setSemesters] = useState([
    { id: 1, courses: [{ name: '', credits: '', grade: '' }] },
  ]);
  const [result, setResult] = useState(null);

  const gradePoints = {
    'A': 5,
    'B': 4,
    'C': 3,
    'D': 2,
    'E': 1,
    'F': 0,
  };

  const addSemester = () => {
    setSemesters([
      ...semesters,
      { id: semesters.length + 1, courses: [{ name: '', credits: '', grade: '' }] },
    ]);
  };

  const removeSemester = (id) => {
    if (semesters.length === 1) {
      alert('You need at least one semester');
      return;
    }
    setSemesters(semesters.filter((s) => s.id !== id));
  };

  const addCourse = (semesterId) => {
    setSemesters(
      semesters.map((s) =>
        s.id === semesterId
          ? { ...s, courses: [...s.courses, { name: '', credits: '', grade: '' }] }
          : s
      )
    );
  };

  const removeCourse = (semesterId, index) => {
    setSemesters(
      semesters.map((s) =>
        s.id === semesterId
          ? { ...s, courses: s.courses.filter((_, i) => i !== index) }
          : s
      )
    );
  };

  const updateCourse = (semesterId, index, field, value) => {
    setSemesters(
      semesters.map((s) =>
        s.id === semesterId
          ? {
              ...s,
              courses: s.courses.map((c, i) =>
                i === index ? { ...c, [field]: value } : c
              ),
            }
          : s
      )
    );
  };

  const calculate = () => {
    let totalCredits = 0;
    let totalPoints = 0;
    const semesterResults = [];

    for (const semester of semesters) {
      let semCredits = 0;
      let semPoints = 0;

      for (const course of semester.courses) {
        const credits = parseFloat(course.credits) || 0;
        const grade = course.grade;
        const points = gradePoints[grade] || 0;

        semCredits += credits;
        semPoints += credits * points;
        totalCredits += credits;
        totalPoints += credits * points;
      }

      semesterResults.push({
        id: semester.id,
        credits: semCredits,
        points: semPoints,
        gpa: semCredits > 0 ? (semPoints / semCredits).toFixed(2) : 0,
      });
    }

    const cgpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0;
    const classification =
      cgpa >= 4.5
        ? 'First Class'
        : cgpa >= 3.5
        ? 'Second Class (Upper)'
        : cgpa >= 2.5
        ? 'Second Class (Lower)'
        : cgpa >= 1.5
        ? 'Third Class'
        : 'Pass';

    setResult({
      cgpa,
      classification,
      semesterResults,
      totalCredits,
      totalPoints,
    });
  };

  const resetAll = () => {
    setSemesters([{ id: 1, courses: [{ name: '', credits: '', grade: '' }] }]);
    setResult(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h1 className="text-3xl font-extrabold text-brand-blue mb-2">
            📊 CGPA Calculator
          </h1>
          <p className="text-gray-600 mb-6">
            Calculate your Cumulative Grade Point Average (CGPA).
          </p>

          {semesters.map((semester) => (
            <div key={semester.id} className="mb-6 p-4 border rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-brand-blue">
                  Semester {semester.id}
                </h3>
                <button
                  onClick={() => removeSemester(semester.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove Semester
                </button>
              </div>

              <div className="space-y-2">
                {semester.courses.map((course, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Course Name"
                      value={course.name}
                      onChange={(e) =>
                        updateCourse(semester.id, index, 'name', e.target.value)
                      }
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Credits"
                      value={course.credits}
                      onChange={(e) =>
                        updateCourse(semester.id, index, 'credits', e.target.value)
                      }
                      className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <select
                      value={course.grade}
                      onChange={(e) =>
                        updateCourse(semester.id, index, 'grade', e.target.value)
                      }
                      className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Grade</option>
                      {Object.keys(gradePoints).map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeCourse(semester.id, index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      disabled={semester.courses.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addCourse(semester.id)}
                className="mt-2 text-brand-blue text-sm font-semibold hover:underline"
              >
                + Add Course
              </button>
            </div>
          ))}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={addSemester}
              className="bg-brand-blue text-white px-6 py-2 rounded-full font-bold hover:opacity-90"
            >
              + Add Semester
            </button>
            <button
              onClick={calculate}
              className="bg-brand-yellow text-brand-dark px-6 py-2 rounded-full font-bold hover:opacity-90"
            >
              Calculate CGPA
            </button>
            <button
              onClick={resetAll}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-full font-bold hover:bg-gray-300"
            >
              Reset
            </button>
          </div>

          {result && (
            <div className="mt-8 bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6">
              <h2 className="text-2xl font-extrabold text-brand-blue mb-4">
                📊 Your CGPA
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-sm text-gray-500">CGPA</p>
                  <p className="text-3xl font-extrabold text-brand-blue">
                    {result.cgpa}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-sm text-gray-500">Classification</p>
                  <p className="text-xl font-extrabold text-brand-blue">
                    {result.classification}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {result.semesterResults.map((sem) => (
                  <div key={sem.id} className="flex justify-between text-sm border-b pb-1">
                    <span>Semester {sem.id}</span>
                    <span>GPA: {sem.gpa}</span>
                    <span>Credits: {sem.credits}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Total Credits: {result.totalCredits} · Total Points: {result.totalPoints}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Server Component Page ────────────────────────────────
export default function CGPACalculatorPage() {
  return (
    <>
      <Navbar />
      <Calculator />
      <Footer />
    </>
  );
}