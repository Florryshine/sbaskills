'use client';

import { useState } from 'react';

export default function WAECGradeClient() {
  const [subjects, setSubjects] = useState([
    { name: '', grade: '' },
    { name: '', grade: '' },
    { name: '', grade: '' },
    { name: '', grade: '' },
    { name: '', grade: '' },
  ]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const allSubjects = [
    'English Language', 'Mathematics', 'Biology', 'Chemistry', 'Physics',
    'Economics', 'Commerce', 'Government', 'Literature-in-English',
    'Christian Religious Studies (CRS)', 'Islamic Religious Studies (IRS)',
    'Geography', 'History', 'Civic Education', 'Agricultural Science',
    'Computer Studies / ICT', 'French', 'Music', 'Art', 'Further Mathematics',
    'Accounting', 'Marketing', 'Insurance', 'Office Practice', 'Data Processing',
    'Home Economics', 'Food and Nutrition', 'Technical Drawing', 'Building Construction',
    'Woodwork', 'Metalwork', 'Electronics', 'Basic Electricity', 'Auto Mechanics',
    'Catering Craft', 'Leatherwork', 'Sculpture', 'Painting', 'Social Studies',
    'Physical Education', 'Arabic', 'Hausa', 'Igbo', 'Yoruba'
  ];

  const gradePoints = {
    'A1': 10, 'B2': 9, 'B3': 8, 'C4': 7, 'C5': 6, 'C6': 5,
    'D7': 4, 'E8': 3, 'F9': 0,
  };

  const gradeDescription = {
    'A1': 'Excellent',
    'B2': 'Very Good',
    'B3': 'Good',
    'C4': 'Credit',
    'C5': 'Credit',
    'C6': 'Credit',
    'D7': 'Pass',
    'E8': 'Pass',
    'F9': 'Fail',
  };

  const handleSubjectChange = (index, field, value) => {
    const updated = [...subjects];
    updated[index][field] = value;
    setSubjects(updated);
  };

  const addSubject = () => {
    if (subjects.length >= 20) {
      alert('Maximum 20 subjects allowed.');
      return;
    }
    setSubjects([...subjects, { name: '', grade: '' }]);
  };

  const removeSubject = (index) => {
    if (subjects.length <= 5) {
      alert('You need at least 5 subjects.');
      return;
    }
    const updated = [...subjects];
    updated.splice(index, 1);
    setSubjects(updated);
  };

  const calculate = () => {
    setLoading(true);
    const selected = subjects.filter(s => s.name && s.grade);
    if (selected.length < 5) {
      alert('Please enter at least 5 subjects with grades.');
      setLoading(false);
      return;
    }

    const graded = selected.map(s => ({
      name: s.name,
      grade: s.grade,
      points: gradePoints[s.grade] || 0,
      description: gradeDescription[s.grade] || '',
    }));

    const sorted = [...graded].sort((a, b) => b.points - a.points);
    const top5 = sorted.slice(0, 5);
    const totalPoints = sorted.reduce((sum, s) => sum + s.points, 0);
    const average = (totalPoints / sorted.length).toFixed(2);
    const top5Points = top5.reduce((sum, s) => sum + s.points, 0);
    const aggregate = top5Points;

    let classification = '';
    if (top5Points >= 45) classification = '🎓 Excellent! (A1/B2 average)';
    else if (top5Points >= 35) classification = '📚 Good (B3/C4 average)';
    else if (top5Points >= 25) classification = '📖 Fair (C5/C6 average)';
    else if (top5Points >= 15) classification = '⚠️ Needs Improvement';
    else classification = '❌ Try Harder';

    setResult({
      totalPoints,
      average,
      top5Points,
      aggregate,
      classification,
      graded: graded,
      top5: top5,
      subjectCount: graded.length,
    });
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h1 className="text-3xl font-extrabold text-brand-blue mb-2">📊 WAEC Grade Calculator</h1>
        <p className="text-gray-600 mb-6">Calculate your WAEC grade points, total points, average, and aggregate.</p>

        <div className="space-y-3">
          {subjects.map((subject, index) => (
            <div key={index} className="flex gap-3 items-center">
              <select
                value={subject.name}
                onChange={(e) => handleSubjectChange(index, 'name', e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select Subject</option>
                {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={subject.grade}
                onChange={(e) => handleSubjectChange(index, 'grade', e.target.value)}
                className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Grade</option>
                {Object.keys(gradePoints).map(grade => <option key={grade} value={grade}>{grade}</option>)}
              </select>
              {subjects.length > 5 && (
                <button onClick={() => removeSubject(index)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
              )}
            </div>
          ))}
          <button onClick={addSubject} className="mt-2 text-brand-blue text-sm font-semibold hover:underline">+ Add Subject</button>
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="mt-6 w-full bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Calculating...' : 'Calculate WAEC Points'}
        </button>

        {result && (
          <div className="mt-8 bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6">
            <h2 className="text-xl font-extrabold text-brand-blue mb-4">📊 Your WAEC Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-sm text-gray-500">Total Points</p>
                <p className="text-2xl font-extrabold text-brand-blue">{result.totalPoints}</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-sm text-gray-500">Average Points</p>
                <p className="text-2xl font-extrabold text-purple-600">{result.average}</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-sm text-gray-500">Best 5 Points</p>
                <p className="text-2xl font-extrabold text-green-600">{result.top5Points}</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-sm text-gray-500">Classification</p>
                <p className="text-sm font-bold text-brand-blue">{result.classification}</p>
              </div>
            </div>

            <h3 className="font-bold text-gray-800 mb-3">All Subjects</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">#</th>
                    <th className="px-4 py-2 text-left font-semibold">Subject</th>
                    <th className="px-4 py-2 text-left font-semibold">Grade</th>
                    <th className="px-4 py-2 text-left font-semibold">Points</th>
                    <th className="px-4 py-2 text-left font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.graded.map((s, idx) => (
                    <tr key={idx} className={idx < 5 ? 'bg-green-50' : ''}>
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium">{s.name}</td>
                      <td className="px-4 py-2 font-bold">{s.grade}</td>
                      <td className="px-4 py-2">{s.points}</td>
                      <td className="px-4 py-2 text-sm">{s.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.top5.length > 0 && (
              <div className="mt-4 bg-yellow-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-yellow-800">
                  ⭐ Top 5 Subjects (used for JAMB aggregate):{' '}
                  {result.top5.map(s => `${s.name} (${s.points}pts)`).join(', ')}
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  JAMB Aggregate Points: <strong>{result.aggregate}</strong>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}