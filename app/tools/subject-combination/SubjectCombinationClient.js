'use client';

import { useState } from 'react';

// Course database – this is a simplified version; you can expand it.
const courseData = {
  'Medicine': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Medicine requires a strong foundation in biological and physical sciences.',
    career: 'Doctor, Surgeon, Medical Researcher',
  },
  'Nursing': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics or Mathematics'],
    description: 'Nursing requires a solid understanding of biological sciences.',
    career: 'Nurse, Midwife, Public Health Nurse',
  },
  'Pharmacy': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Pharmacy requires strong chemistry and biology backgrounds.',
    career: 'Pharmacist, Pharmaceutical Researcher',
  },
  'Engineering': {
    subjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
    description: 'Engineering requires strong mathematical and physical science skills.',
    career: 'Engineer (Civil, Mechanical, Electrical, etc.)',
  },
  'Computer Science': {
    subjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry or Biology'],
    description: 'Computer Science requires strong analytical and mathematical skills.',
    career: 'Software Developer, Data Scientist, IT Consultant',
  },
  'Law': {
    subjects: ['English Language', 'Literature-in-English', 'Government', 'CRS/IRS or History'],
    description: 'Law requires strong reading, writing, and analytical skills.',
    career: 'Lawyer, Judge, Legal Consultant',
  },
  'Economics': {
    subjects: ['English Language', 'Mathematics', 'Economics', 'Government or Geography'],
    description: 'Economics requires a blend of analytical and social science skills.',
    career: 'Economist, Financial Analyst, Policy Advisor',
  },
  'Business Administration': {
    subjects: ['English Language', 'Mathematics', 'Economics', 'Government or Commerce'],
    description: 'Business Administration requires a mix of analytical and management skills.',
    career: 'Business Manager, Entrepreneur, Marketing Manager',
  },
  'Biochemistry': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Biochemistry requires a strong foundation in biological and chemical sciences.',
    career: 'Biochemist, Medical Researcher, Pharmaceutical Scientist',
  },
};

export default function SubjectCombinationClient() {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [result, setResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const courses = Object.keys(courseData);
  const filteredCourses = courses.filter(course =>
    course.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const checkCombination = () => {
    if (selectedCourse && courseData[selectedCourse]) {
      setResult(courseData[selectedCourse]);
    } else {
      alert('Please select a valid course.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h1 className="text-3xl font-extrabold text-brand-blue mb-2">🎓 Subject Combination Checker</h1>
        <p className="text-gray-600 mb-6">Check the correct JAMB subject combination for your desired course.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Search or Select Your Course *</label>
            <div className="flex flex-wrap gap-3">
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="flex-1 min-w-[200px] rounded-xl border border-slate-200 px-4 py-2"
              >
                <option value="">Select a course...</option>
                {filteredCourses.map((course) => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[150px] rounded-xl border border-slate-200 px-4 py-2"
              />
              <button
                onClick={checkCombination}
                className="bg-brand-yellow text-brand-dark px-6 py-2 rounded-full font-bold hover:opacity-90"
              >
                Check
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-8 bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6">
            <h2 className="text-xl font-extrabold text-brand-blue mb-4">📋 Subject Combination for {selectedCourse}</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">✅ Required Subjects:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {result.subjects.map((subject, i) => (
                    <li key={i} className="text-gray-700">{subject}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4">
                <p className="text-sm text-gray-700"><span className="font-semibold">💡 Note:</span> {result.description}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-gray-700"><span className="font-semibold">🚀 Career Paths:</span> {result.career}</p>
              </div>
              <div className="bg-brand-blue/10 rounded-xl p-4">
                <p className="text-sm text-gray-700"><span className="font-semibold">📌 Tip:</span> Always check the official JAMB brochure for the latest requirements.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}