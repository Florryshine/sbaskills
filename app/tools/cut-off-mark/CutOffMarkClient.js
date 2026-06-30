'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function CutOffMarkClient() {
  const [loading, setLoading] = useState(false);
  const [searchSchool, setSearchSchool] = useState('');
  const [searchCourse, setSearchCourse] = useState('');
  const [results, setResults] = useState([]);
  const [schools, setSchools] = useState([]);
  const [courses, setCourses] = useState([]);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchFilters() {
      const { data: schoolData } = await supabase.from('school_cutoffs').select('school_name');
      if (schoolData) setSchools([...new Set(schoolData.map(s => s.school_name).filter(Boolean))]);
      const { data: courseData } = await supabase.from('school_cutoffs').select('course_name');
      if (courseData) setCourses([...new Set(courseData.map(c => c.course_name).filter(Boolean))]);
    }
    fetchFilters();
  }, []);

  const searchCutoffs = async () => {
    setLoading(true);
    let query = supabase.from('school_cutoffs').select('*');
    if (searchSchool) query = query.ilike('school_name', `%${searchSchool}%`);
    if (searchCourse) query = query.ilike('course_name', `%${searchCourse}%`);
    const { data, error } = await query.order('school_name').order('course_name').limit(200);
    if (error) alert('Error: ' + error.message);
    setResults(data || []);
    setLoading(false);
  };

  const resetSearch = () => {
    setSearchSchool('');
    setSearchCourse('');
    setResults([]);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h1 className="text-3xl font-extrabold text-brand-blue mb-2">📉 Cut-off Mark Checker</h1>
        <p className="text-gray-600 mb-6">Search for cut-off marks of Nigerian universities, polytechnics, and colleges.</p>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={searchSchool}
              onChange={(e) => setSearchSchool(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2"
            >
              <option value="">All Schools</option>
              {schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={searchCourse}
              onChange={(e) => setSearchCourse(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2"
            >
              <option value="">All Courses</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={searchCutoffs} disabled={loading} className="bg-brand-yellow text-brand-dark px-6 py-2 rounded-full font-bold hover:opacity-90 disabled:opacity-50">
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button onClick={resetSearch} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-full font-bold hover:bg-gray-300">Reset</button>
          </div>
        </div>

        {loading && <div className="mt-8 text-center py-12 text-gray-500">Searching...</div>}

        {!loading && results.length === 0 && (searchSchool || searchCourse) && (
          <div className="mt-8 text-center py-12"><p className="text-4xl mb-4">🔍</p><p className="text-gray-500">No results found.</p></div>
        )}

        {!loading && results.length > 0 && (
          <div className="mt-8">
            <p className="text-sm text-gray-500 mb-4">Found {results.length} record{results.length !== 1 ? 's' : ''}</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr><th className="px-4 py-3 text-left font-semibold">#</th><th className="px-4 py-3 text-left font-semibold">School</th><th className="px-4 py-3 text-left font-semibold">Course</th><th className="px-4 py-3 text-left font-semibold">Cut-off Mark</th><th className="px-4 py-3 text-left font-semibold">JAMB Requirement</th></tr>
                </thead>
                <tbody className="divide-y">
                  {results.map((row, i) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{i+1}</td>
                      <td className="px-4 py-3 font-medium">{row.school_name}</td>
                      <td className="px-4 py-3">{row.course_name}</td>
                      <td className="px-4 py-3 font-bold text-brand-blue">{row.cut_off_mark ?? 'N/A'}</td>
                      <td className="px-4 py-3">{row.jamb_requirement ?? 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}