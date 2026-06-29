import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = generateToolMetadata(toolsSEO['subject-combination']);

// ─── Client Component ──────────────────────────────────────
'use client';

import { useState } from 'react';

// Database of courses and their subject combinations
const courseData = {
  'Medicine': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Medicine requires a strong foundation in biological and physical sciences.',
    career: 'Doctor, Surgeon, Medical Researcher, Public Health Specialist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB',
  },
  'Nursing': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics or Mathematics'],
    description: 'Nursing requires a solid understanding of biological sciences and patient care.',
    career: 'Nurse, Midwife, Public Health Nurse, Nursing Educator',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Pharmacy': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Pharmacy requires strong chemistry and biology backgrounds.',
    career: 'Pharmacist, Pharmaceutical Researcher, Drug Development Specialist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB',
  },
  'Engineering': {
    subjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
    description: 'Engineering requires strong mathematical and physical science skills.',
    career: 'Engineer (Civil, Mechanical, Electrical, Chemical, etc.)',
    schools: 'UNILAG, UNIBEN, OAU, UI, FUTA, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUTO, FUNAAB',
  },
  'Computer Science': {
    subjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry or Biology'],
    description: 'Computer Science requires strong analytical and mathematical skills.',
    career: 'Software Developer, Data Scientist, AI Engineer, IT Consultant',
    schools: 'UNILAG, UNIBEN, OAU, UI, FUTA, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB',
  },
  'Law': {
    subjects: ['English Language', 'Literature-in-English', 'Government', 'CRS/IRS or History'],
    description: 'Law requires strong reading, writing, and analytical skills.',
    career: 'Lawyer, Judge, Legal Consultant, Corporate Counsel',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Economics': {
    subjects: ['English Language', 'Mathematics', 'Economics', 'Government or Geography'],
    description: 'Economics requires a blend of analytical and social science skills.',
    career: 'Economist, Financial Analyst, Policy Advisor, Data Analyst',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, NASU',
  },
  'Business Administration': {
    subjects: ['English Language', 'Mathematics', 'Economics', 'Government or Commerce'],
    description: 'Business Administration requires a mix of analytical and management skills.',
    career: 'Business Manager, Entrepreneur, Marketing Manager, Consultant',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Biochemistry': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Biochemistry requires a strong foundation in biological and chemical sciences.',
    career: 'Biochemist, Medical Researcher, Pharmaceutical Scientist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB',
  },
  'Microbiology': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Microbiology requires a strong understanding of biological sciences.',
    career: 'Microbiologist, Public Health Specialist, Laboratory Scientist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB',
  },
  'Psychology': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Mathematics or Physics'],
    description: 'Psychology requires a blend of biological and social science knowledge.',
    career: 'Psychologist, Counselor, Human Resources Specialist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Mass Communication': {
    subjects: ['English Language', 'Literature-in-English', 'Government', 'CRS/IRS or History'],
    description: 'Mass Communication requires strong writing, analytical, and media skills.',
    career: 'Journalist, Media Producer, Public Relations Specialist, Content Creator',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Architecture': {
    subjects: ['English Language', 'Mathematics', 'Physics', 'Fine Art or Geography'],
    description: 'Architecture requires strong design, mathematical, and spatial skills.',
    career: 'Architect, Urban Planner, Interior Designer, Construction Manager',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB',
  },
  'Veterinary Medicine': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Veterinary Medicine requires a strong background in biological sciences.',
    career: 'Veterinarian, Animal Health Specialist, Veterinary Researcher',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB',
  },
  'Dentistry': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Dentistry requires a strong foundation in biological and physical sciences.',
    career: 'Dentist, Orthodontist, Dental Surgeon, Public Health Dentist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Physiotherapy': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Physiotherapy requires a strong understanding of human anatomy and movement.',
    career: 'Physiotherapist, Rehabilitation Specialist, Sports Therapist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Radiography': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Radiography requires a strong background in biological and physical sciences.',
    career: 'Radiographer, Medical Imaging Specialist, Radiation Therapist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Medical Laboratory Science': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    description: 'Medical Laboratory Science requires a strong foundation in biological and chemical sciences.',
    career: 'Medical Laboratory Scientist, Clinical Researcher, Diagnostic Specialist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Accounting': {
    subjects: ['English Language', 'Mathematics', 'Economics', 'Accounting or Commerce'],
    description: 'Accounting requires strong analytical and numerical skills.',
    career: 'Accountant, Auditor, Financial Analyst, Tax Consultant',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Insurance': {
    subjects: ['English Language', 'Mathematics', 'Economics', 'Commerce or Government'],
    description: 'Insurance requires a blend of analytical and business skills.',
    career: 'Insurance Broker, Underwriter, Risk Manager, Claims Adjuster',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Marketing': {
    subjects: ['English Language', 'Mathematics', 'Economics', 'Commerce or Government'],
    description: 'Marketing requires creativity, analytical skills, and business acumen.',
    career: 'Marketing Manager, Brand Strategist, Digital Marketer, Sales Manager',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Agriculture': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Mathematics or Physics'],
    description: 'Agriculture requires a blend of biological, chemical, and physical sciences.',
    career: 'Agriculturist, Agronomist, Agricultural Economist, Farm Manager',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, FUTA, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB, FUTO',
  },
  'Geology': {
    subjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry or Geography'],
    description: 'Geology requires strong physical and earth science knowledge.',
    career: 'Geologist, Mining Engineer, Environmental Scientist, Petroleum Geologist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB',
  },
  'Geography': {
    subjects: ['English Language', 'Geography', 'Mathematics', 'Biology or Physics'],
    description: 'Geography requires a blend of physical and social science skills.',
    career: 'Geographer, Urban Planner, Environmental Consultant, Cartographer',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'History': {
    subjects: ['English Language', 'History', 'Government', 'CRS/IRS or Literature'],
    description: 'History requires strong analytical, reading, and writing skills.',
    career: 'Historian, Researcher, Archivist, Museum Curator, Educator',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Political Science': {
    subjects: ['English Language', 'Government', 'History or CRS/IRS', 'Economics or Geography'],
    description: 'Political Science requires strong analytical and social science skills.',
    career: 'Political Scientist, Policy Analyst, Public Administrator, Diplomat',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Sociology': {
    subjects: ['English Language', 'Government', 'CRS/IRS or History', 'Economics or Geography'],
    description: 'Sociology requires a strong understanding of social structures and human behavior.',
    career: 'Sociologist, Social Worker, Community Development Officer, Policy Analyst',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Philosophy': {
    subjects: ['English Language', 'Government', 'CRS/IRS or History', 'Literature-in-English'],
    description: 'Philosophy requires strong critical thinking and analytical skills.',
    career: 'Philosopher, Ethics Consultant, Educator, Researcher',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Fine and Applied Arts': {
    subjects: ['English Language', 'Fine Art or Music', 'CRS/IRS or History', 'Literature-in-English'],
    description: 'Fine Arts requires creativity, visual skills, and cultural knowledge.',
    career: 'Artist, Graphic Designer, Curator, Art Educator, Creative Director',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Music': {
    subjects: ['English Language', 'Music', 'CRS/IRS or History', 'Literature-in-English'],
    description: 'Music requires performance skills, theory, and cultural knowledge.',
    career: 'Musician, Music Educator, Composer, Music Producer',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Theatre Arts': {
    subjects: ['English Language', 'Literature-in-English', 'CRS/IRS or History', 'Government'],
    description: 'Theatre Arts requires creativity, performance skills, and cultural knowledge.',
    career: 'Actor, Director, Playwright, Theatre Manager, Drama Educator',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Linguistics': {
    subjects: ['English Language', 'CRS/IRS or History', 'Government', 'Literature-in-English'],
    description: 'Linguistics requires strong analytical and language skills.',
    career: 'Linguist, Language Teacher, Translator, Speech Therapist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Foreign Languages': {
    subjects: ['English Language', 'CRS/IRS or History', 'Government', 'Literature-in-English'],
    description: 'Foreign Languages requires language proficiency and cultural understanding.',
    career: 'Translator, Language Teacher, Diplomat, International Business Specialist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Christian Religious Studies': {
    subjects: ['English Language', 'CRS', 'Government', 'History or Literature'],
    description: 'CRS requires deep knowledge of religious texts and ethical reasoning.',
    career: 'Theologian, Religious Educator, Counselor, Pastor, Researcher',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Islamic Studies': {
    subjects: ['English Language', 'IRS', 'Government', 'History or Literature'],
    description: 'Islamic Studies requires deep knowledge of Islamic texts and ethical reasoning.',
    career: 'Islamic Scholar, Religious Educator, Counselor, Imam, Researcher',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Library and Information Science': {
    subjects: ['English Language', 'Government', 'CRS/IRS or History', 'Literature'],
    description: 'Library Science requires organizational, research, and information management skills.',
    career: 'Librarian, Archivist, Information Specialist, Knowledge Manager',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Education': {
    subjects: ['English Language', 'Mathematics', 'Biology or Chemistry', 'Physics or Geography'],
    description: 'Education requires a broad foundation in both arts and sciences.',
    career: 'Teacher, Education Administrator, Curriculum Developer, Education Consultant',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, IMSU',
  },
  'Physical and Health Education': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics or Mathematics'],
    description: 'Physical Education requires knowledge of human anatomy and health sciences.',
    career: 'Physical Education Teacher, Sports Coach, Fitness Instructor, Health Educator',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Home Economics': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Food and Nutrition or Home Economics'],
    description: 'Home Economics requires practical skills in food, nutrition, and family management.',
    career: 'Home Economist, Food Scientist, Nutritionist, Consumer Advocate',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU',
  },
  'Food Science and Technology': {
    subjects: ['English Language', 'Biology', 'Chemistry', 'Physics or Mathematics'],
    description: 'Food Science requires a strong foundation in biological and chemical sciences.',
    career: 'Food Technologist, Quality Control Specialist, Research Scientist',
    schools: 'UNILAG, UNIBEN, OAU, UI, UNN, ABU, UNILORIN, UNIUYO, UNIPORT, DELSU, EKSU, FUNAAB',
  },
};

function SubjectCombinationChecker() {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [result, setResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const courses = Object.keys(courseData);

  const checkCombination = () => {
    if (selectedCourse && courseData[selectedCourse]) {
      setResult(courseData[selectedCourse]);
    } else {
      setResult(null);
      alert('Please select a valid course.');
    }
  };

  const filteredCourses = courses.filter(course =>
    course.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-brand-blue">
              🎓 Subject Combination Checker
            </h1>
            <p className="text-gray-600 mt-2">
              Check the correct JAMB subject combination for your desired course.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Search or Select Your Course *
              </label>
              <div className="flex flex-wrap gap-3">
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="flex-1 min-w-[200px] rounded-xl border border-slate-200 px-4 py-2"
                >
                  <option value="">Select a course...</option>
                  {filteredCourses.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
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
              <h2 className="text-xl font-extrabold text-brand-blue mb-4">
                📋 Subject Combination for {selectedCourse}
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">✅ Required Subjects:</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {result.subjects.map((subject, i) => (
                      <li key={i} className="text-gray-700">
                        {subject}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">💡 Note:</span> {result.description}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">🚀 Career Paths:</span> {result.career}
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">🏫 Top Schools:</span> {result.schools}
                  </p>
                </div>
                <div className="bg-brand-blue/10 rounded-xl p-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">📌 Tip:</span> Always check the official JAMB brochure for the latest subject requirements.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Server Component Page ────────────────────────────────
export default function SubjectCombinationCheckerPage() {
  return (
    <>
      <Navbar />
      <SubjectCombinationChecker />
      <Footer />
    </>
  );
}