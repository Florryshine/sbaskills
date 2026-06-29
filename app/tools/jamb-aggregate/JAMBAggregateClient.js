'use client';

import { useState } from 'react';

// All common WAEC/JAMB subjects
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
  'D7': 4, 'E8': 3, 'F9': 0
};

export default function JAMBAggregateClient() {
  const [formData, setFormData] = useState({
    jambScore: '',
    subjects: [
      { name: '', grade: '' },
      { name: '', grade: '' },
      { name: '', grade: '' },
      { name: '', grade: '' },
      { name: '', grade: '' },
    ],
    school: '',
    course: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubjectChange = (index, field, value) => {
    const updated = [...formData.subjects];
    updated[index][field] = value;
    setFormData({ ...formData, subjects: updated });
  };

  const calculateAggregate = () => {
    setLoading(true);
    const selected = formData.subjects.filter(s => s.name && s.grade);
    if (selected.length < 5) {
      alert('Please select at least 5 subjects and their grades.');
      setLoading(false);
      return;
    }

    const sorted = selected
      .map(s => ({ name: s.name, points: gradePoints[s.grade] || 0 }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    const waecPoints = sorted.reduce((sum, s) => sum + s.points, 0);
    const jambScore = parseInt(formData.jambScore) || 0;
    const aggregate = (jambScore / 8) + waecPoints;

    let chance = 'Unknown';
    let chanceColor = 'text-gray-500';
    if (formData.school && formData.course) {
      chance = 'Check with your institution';
      chanceColor = 'text-brand-blue';
    }

    setResult({
      aggregate: aggregate.toFixed(2),
      waecPoints,
      jambScore,
      chance,
      chanceColor,
      breakdown: {
        'JAMB Score': `${jambScore} (${(jambScore / 8).toFixed(2)} pts)`,
        'WAEC Points (Best 5)': waecPoints,
        'Total Aggregate': aggregate.toFixed(2),
      },
      topSubjects: sorted,
    });
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h1 className="text-3xl font-extrabold text-brand-blue mb-2">🎯 JAMB Aggregate Calculator</h1>
        <p className="text-gray-600 mb-6">Calculate your JAMB aggregate score based on your JAMB score and WAEC/O'Level grades.</p>

        <form onSubmit={(e) => { e.preventDefault(); calculateAggregate(); }} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-1">JAMB Score *</label>
            <input
              type="number"
              required
              min="0"
              max="400"
              value={formData.jambScore}
              onChange={(e) => setFormData({ ...formData, jambScore: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
              placeholder="e.g., 250"
            />
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">WAEC/O'Level Subjects (Select 5 or more – best 5 used)</p>
            <div className="space-y-3">
              {formData.subjects.map((subject, index) => (
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
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold mb-1">School (Optional)</label>
              <input
                type="text"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2"
                placeholder="e.g., UNILAG"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Course (Optional)</label>
              <input
                type="text"
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2"
                placeholder="e.g., Medicine"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Calculating...' : 'Calculate Aggregate'}
          </button>
        </form>

        {result && (
          <div className="mt-8 bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6">
            <h2 className="text-xl font-extrabold text-brand-blue mb-4">📊 Your Results</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">JAMB Score</span>
                <span>{result.breakdown['JAMB Score']}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">WAEC Points (Best 5)</span>
                <span>{result.waecPoints}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">Subjects Used</span>
                <span className="text-sm">{result.topSubjects.map(s => `${s.name} (${s.points})`).join(', ')}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2">
                <span className="font-bold text-lg">Aggregate</span>
                <span className="text-2xl font-extrabold text-brand-blue">{result.aggregate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold">Admission Chance</span>
                <span className={`font-bold ${result.chanceColor}`}>{result.chance}</span>
              </div>
            </div>
            {!formData.school && !formData.course && (
              <p className="text-sm text-gray-500 mt-4">💡 Enter a school and course above to check your admission chance.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}