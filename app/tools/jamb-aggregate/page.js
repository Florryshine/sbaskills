'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function JAMBAggregateCalculator() {
  const [formData, setFormData] = useState({
    jambScore: '',
    waecGrades: {
      english: '',
      maths: '',
      biology: '',
      chemistry: '',
      physics: '',
    },
    school: '',
    course: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const gradePoints = {
    'A1': 10,
    'B2': 9,
    'B3': 8,
    'C4': 7,
    'C5': 6,
    'C6': 5,
    'D7': 4,
    'E8': 3,
    'F9': 0,
  };

  const calculateAggregate = () => {
    setLoading(true);

    const grades = Object.values(formData.waecGrades).filter(g => g);
    if (grades.length < 5) {
      alert('Please enter grades for at least 5 subjects');
      setLoading(false);
      return;
    }

    const sortedGrades = grades
      .map(g => gradePoints[g] || 0)
      .sort((a, b) => b - a)
      .slice(0, 5);

    const waecPoints = sortedGrades.reduce((sum, p) => sum + p, 0);
    const jambScore = parseInt(formData.jambScore) || 0;
    const aggregate = (jambScore / 8) + waecPoints;

    let chance = 'Unknown';
    let chanceColor = 'text-gray-500';

    if (formData.school && formData.course) {
      // Check against school_cutoffs table
      // For now, show placeholder
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
    });
    setLoading(false);
  };

  const subjectList = ['english', 'maths', 'biology', 'chemistry', 'physics'];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-extrabold text-brand-blue">
                🎯 JAMB Aggregate Calculator
              </h1>
              <p className="text-gray-600 mt-2">
                Calculate your JAMB aggregate score and check your admission chances.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                calculateAggregate();
              }}
              className="space-y-6"
            >
              {/* JAMB Score */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  JAMB Score *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="400"
                  value={formData.jambScore}
                  onChange={(e) =>
                    setFormData({ ...formData, jambScore: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-2"
                  placeholder="e.g., 250"
                />
              </div>

              {/* WAEC Grades */}
              <div>
                <p className="text-sm font-semibold mb-2">
                  WAEC/O'Level Grades (Enter best 5 subjects)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {subjectList.map((subject) => (
                    <div key={subject}>
                      <label className="block text-xs font-semibold text-gray-600 capitalize mb-1">
                        {subject}
                      </label>
                      <select
                        value={formData.waecGrades[subject]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            waecGrades: {
                              ...formData.waecGrades,
                              [subject]: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Select</option>
                        {Object.keys(gradePoints).map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* School & Course */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    School (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.school}
                    onChange={(e) =>
                      setFormData({ ...formData, school: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-2"
                    placeholder="e.g., UNILAG"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Course (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.course}
                    onChange={(e) =>
                      setFormData({ ...formData, course: e.target.value })
                    }
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

            {/* Results */}
            {result && (
              <div className="mt-8 bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6">
                <h2 className="text-xl font-extrabold text-brand-blue mb-4">
                  📊 Your Results
                </h2>
                <div className="space-y-3">
                  {Object.entries(result.breakdown).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center border-b pb-2">
                      <span className="font-semibold">{key}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t-2">
                    <span className="font-bold text-lg">Aggregate</span>
                    <span className="text-2xl font-extrabold text-brand-blue">
                      {result.aggregate}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Admission Chance</span>
                    <span className={`font-bold ${result.chanceColor}`}>
                      {result.chance}
                    </span>
                  </div>
                </div>
                {!formData.school && !formData.course && (
                  <p className="text-sm text-gray-500 mt-4">
                    💡 Enter a school and course above to check your admission chance.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}