'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function AdmissionChanceClient() {
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [formData, setFormData] = useState({
    jambScore: '',
    school: '',
    course: '',
    waecGrades: {
      english: '',
      maths: '',
      biology: '',
      chemistry: '',
      physics: '',
    },
  });
  const [result, setResult] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchData() {
      const { data: schoolData } = await supabase
        .from('school_cutoffs')
        .select('school_name, course_name, cut_off_mark, jamb_requirement')
        .order('school_name');

      if (schoolData) {
        const uniqueSchools = [...new Set(schoolData.map(s => s.school_name))];
        const uniqueCourses = [...new Set(schoolData.map(s => s.course_name))];
        setSchools(uniqueSchools);
        setCourses(uniqueCourses);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.school) {
      const fetchCourses = async () => {
        const { data } = await supabase
          .from('school_cutoffs')
          .select('course_name')
          .eq('school_name', formData.school);
        if (data) {
          const unique = [...new Set(data.map(c => c.course_name))];
          setFilteredCourses(unique);
        }
      };
      fetchCourses();
    } else {
      setFilteredCourses([]);
    }
  }, [formData.school]);

  const gradePoints = {
    'A1': 10, 'B2': 9, 'B3': 8, 'C4': 7, 'C5': 6, 'C6': 5,
    'D7': 4, 'E8': 3, 'F9': 0,
  };

  const calculateChance = async () => {
    setLoading(true);
    setResult(null);

    const jambScore = parseInt(formData.jambScore) || 0;
    if (!jambScore || jambScore < 0 || jambScore > 400) {
      alert('Please enter a valid JAMB score (0-400).');
      setLoading(false);
      return;
    }

    if (!formData.school || !formData.course) {
      alert('Please select both a school and a course.');
      setLoading(false);
      return;
    }

    const { data: cutoffData } = await supabase
      .from('school_cutoffs')
      .select('cut_off_mark, jamb_requirement')
      .eq('school_name', formData.school)
      .eq('course_name', formData.course)
      .maybeSingle();

    if (!cutoffData) {
      alert('No cutoff data found for this school and course combination.');
      setLoading(false);
      return;
    }

    const grades = Object.values(formData.waecGrades).filter(g => g);
    let waecPoints = 0;
    if (grades.length >= 5) {
      const sorted = grades
        .map(g => gradePoints[g] || 0)
        .sort((a, b) => b - a)
        .slice(0, 5);
      waecPoints = sorted.reduce((sum, p) => sum + p, 0);
    }

    const aggregate = (jambScore / 8) + waecPoints;
    const cutoff = cutoffData.cut_off_mark || 70;
    const jambRequirement = cutoffData.jamb_requirement || 200;

    let chance = '';
    let chanceColor = '';
    let recommendation = '';

    if (aggregate >= cutoff + 5) {
      chance = '✅ High Chance';
      chanceColor = 'text-green-600';
      recommendation = 'You are well above the cut-off mark. Strongly consider applying!';
    } else if (aggregate >= cutoff) {
      chance = '⚠️ Moderate Chance';
      chanceColor = 'text-yellow-600';
      recommendation = 'You meet the cut-off mark. Focus on your Post-UTME to strengthen your chances.';
    } else if (aggregate >= cutoff - 5) {
      chance = '⚠️ Borderline Chance';
      chanceColor = 'text-orange-600';
      recommendation = 'You are slightly below the cut-off. Consider improving your JAMB or WAEC scores.';
    } else {
      chance = '❌ Low Chance';
      chanceColor = 'text-red-600';
      recommendation = 'You are significantly below the cut-off. Consider alternative courses or schools.';
    }

    let jambStatus = '';
    let jambColor = '';
    if (jambScore >= jambRequirement) {
      jambStatus = '✅ Meets JAMB requirement';
      jambColor = 'text-green-600';
    } else {
      jambStatus = '❌ Below JAMB requirement';
      jambColor = 'text-red-600';
    }

    setResult({
      aggregate: aggregate.toFixed(2),
      cutoff,
      jambRequirement,
      chance,
      chanceColor,
      recommendation,
      jambStatus,
      jambColor,
      waecPoints,
      jambScore,
      school: formData.school,
      course: formData.course,
    });

    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-brand-blue">🔮 Admission Chance Checker</h1>
          <p className="text-gray-600 mt-2">Predict your admission chance based on your JAMB score, WAEC grades, school, and course.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); calculateChance(); }} className="space-y-6">
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
            <label className="block text-sm font-semibold mb-1">School *</label>
            <select
              required
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value, course: '' })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            >
              <option value="">Select your school...</option>
              {schools.map((school) => (
                <option key={school} value={school}>{school}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Course *</label>
            <select
              required
              value={formData.course}
              onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
              disabled={!formData.school}
            >
              <option value="">Select your course...</option>
              {filteredCourses.map((course) => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">WAEC/O'Level Grades (Optional)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {['english', 'maths', 'biology', 'chemistry', 'physics'].map((subject) => (
                <div key={subject}>
                  <label className="block text-xs font-semibold text-gray-600 capitalize mb-1">{subject}</label>
                  <select
                    value={formData.waecGrades[subject]}
                    onChange={(e) => setFormData({
                      ...formData,
                      waecGrades: { ...formData.waecGrades, [subject]: e.target.value }
                    })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    {Object.keys(gradePoints).map((grade) => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check My Admission Chance'}
          </button>
        </form>

        {result && (
          <div className="mt-8 bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6">
            <h2 className="text-xl font-extrabold text-brand-blue mb-4">📊 Admission Chance Report</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-sm text-gray-500">Aggregate</p>
                <p className="text-2xl font-extrabold text-brand-blue">{result.aggregate}</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-sm text-gray-500">Cut-off Mark</p>
                <p className="text-2xl font-extrabold text-purple-600">{result.cutoff}</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-sm text-gray-500">Chance</p>
                <p className={`text-xl font-extrabold ${result.chanceColor}`}>{result.chance}</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-sm text-gray-500">JAMB Requirement</p>
                <p className={`text-lg font-extrabold ${result.jambColor}`}>{result.jambStatus}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">School</span><span>{result.school}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">Course</span><span>{result.course}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">JAMB Score</span><span>{result.jambScore}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">WAEC Points (Best 5)</span><span>{result.waecPoints || 'Not provided'}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">Aggregate Score</span><span className="font-bold">{result.aggregate}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">Cut-off Mark</span><span>{result.cutoff}</span>
              </div>
            </div>
            <div className="mt-4 bg-yellow-50 rounded-xl p-4">
              <p className="text-sm text-gray-700"><span className="font-semibold">💡 Recommendation:</span> {result.recommendation}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}