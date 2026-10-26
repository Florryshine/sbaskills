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
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="subject-guide-heading">
        <h2 id="subject-guide-heading" className="text-2xl font-bold text-brand-blue">How to choose the right JAMB subject combination</h2>
        <p className="mt-3 leading-7 text-gray-700">Your UTME subject combination should match the entry requirements for the exact course and institution you want. Choosing an unsuitable combination can affect eligibility even when your score is strong. Use this checker as a starting point, then confirm both UTME subjects and O’Level requirements in the current JAMB brochure and on your institution’s official admissions website.</p>
        <h3 className="mt-6 text-lg font-bold text-slate-900">Examples of courses and subject requirements</h3>
        <p className="mt-3 leading-7 text-gray-700">The course list in this tool currently provides examples for Medicine, Nursing, Pharmacy, Engineering, Computer Science, Law, Economics, Business Administration and Biochemistry. Requirements shown for some courses include alternatives, and these may not apply to every university. Do not assume that a general example is the final approved combination for your intended institution.</p>
        <h3 className="mt-6 text-lg font-bold text-slate-900">Check these details before registering</h3>
        <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-gray-700">
          <li><strong>Exact course name:</strong> Similar-sounding programmes may have different admission requirements.</li>
          <li><strong>Four UTME subjects:</strong> Confirm the required subjects, including English Language where applicable, for the course.</li>
          <li><strong>O’Level subjects:</strong> Check required credits, acceptable subjects and any grade conditions separately from UTME subjects.</li>
          <li><strong>Institution-specific rules:</strong> A course may have additional or different conditions depending on the university or other institution.</li>
          <li><strong>Current official brochure:</strong> Requirements can be revised. Check the latest official JAMB brochure and your school’s admission notice before making your final choice.</li>
        </ul>
        <p className="mt-4 leading-7 text-gray-700">If your desired course is not listed here, do not guess or choose a nearby option as a substitute. Consult the official requirements for your exact course and institution first.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className="rounded-full bg-brand-blue px-4 py-2 font-semibold text-white hover:opacity-90" href="/tools/admission-chance">Check admission chances</a>
          <a className="rounded-full border border-brand-blue px-4 py-2 font-semibold text-brand-blue hover:bg-blue-50" href="/tools/jamb-aggregate">Calculate aggregate</a>
          <a className="rounded-full border border-brand-blue px-4 py-2 font-semibold text-brand-blue hover:bg-blue-50" href="/tools/cut-off-mark">Check cut-off marks</a>
        </div>
      </section>
    </div>
  );
}