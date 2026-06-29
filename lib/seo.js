// lib/seo.js
export function generateToolMetadata({ title, description, path, keywords = [], image = '/logo.png' }) {
  const baseUrl = 'https://shineybrainacademy.vercel.app';
  const url = `${baseUrl}${path}`;
  
  return {
    title: `${title} | Shiney Brain Academy`,
    description: description,
    keywords: keywords.join(', '),
    openGraph: {
      title: `${title} | Shiney Brain Academy`,
      description: description,
      url: url,
      type: 'website',
      images: [
        {
          url: `${baseUrl}${image}`,
          width: 512,
          height: 512,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Shiney Brain Academy`,
      description: description,
      images: [`${baseUrl}${image}`],
    },
    alternates: {
      canonical: url,
    },
  };
}

export const toolsSEO = {
  'jamb-aggregate': {
    title: 'JAMB Aggregate Calculator',
    description: 'Calculate your JAMB aggregate score using your UTME score and WAEC/O\'Level grades. Find out your admission chances for Nigerian universities.',
    keywords: ['JAMB aggregate calculator', 'JAMB score calculator', 'admission chance', 'UNILAG aggregate', 'OAU aggregate', 'UNIBEN aggregate'],
    path: '/tools/jamb-aggregate',
  },
  'waec-grade-calculator': {
    title: 'WAEC Grade Calculator',
    description: 'Calculate your WAEC grade points, total points, average, and aggregate. See which subjects you excelled in and where you need improvement.',
    keywords: ['WAEC grade calculator', 'WAEC points', 'WAEC aggregate', 'grade calculator', 'WAEC results'],
    path: '/tools/waec-grade-calculator',
  },
  'cgpa-calculator': {
    title: 'CGPA Calculator',
    description: 'Calculate your Cumulative Grade Point Average (CGPA) semester by semester. Track your academic performance and predict your graduation classification.',
    keywords: ['CGPA calculator', 'GPA calculator', 'university grades', 'grade point average', 'Nigerian university CGPA'],
    path: '/tools/cgpa-calculator',
  },
  'subject-combination': {
    title: 'JAMB Subject Combination Checker',
    description: 'Check the correct JAMB subject combination for any course in Nigeria. Find out which subjects you need for Medicine, Law, Engineering, and more.',
    keywords: ['JAMB subject combination', 'subject combination checker', 'courses and subjects', 'JAMB requirements', 'admission requirements'],
    path: '/tools/subject-combination',
  },
  'admission-chance': {
    title: 'Admission Chance Checker',
    description: 'Check your chances of gaining admission into Nigerian universities. Enter your JAMB score, WAEC grades, school, and course to get a personalized prediction.',
    keywords: ['admission chance checker', 'JAMB admission chance', 'university admission prediction', 'admission probability', 'cut-off mark'],
    path: '/tools/admission-chance',
  },
  'cut-off-mark': {
    title: 'University Cut-off Mark Checker',
    description: 'Search for cut-off marks of Nigerian universities, polytechnics, and colleges of education. Find JAMB and departmental cut-off marks for your preferred course.',
    keywords: ['cut-off mark checker', 'university cut-off', 'JAMB cut-off mark', 'departmental cut-off', 'UNILAG cut-off', 'OAU cut-off'],
    path: '/tools/cut-off-mark',
  },
  'past-questions': {
    title: 'Past Question Search',
    description: 'Search for JAMB, WAEC, NECO, and Post-UTME past questions. Find questions by subject, year, topic, and exam type with answers and explanations.',
    keywords: ['past questions search', 'JAMB past questions', 'WAEC past questions', 'NECO past questions', 'exam practice', 'CBT practice'],
    path: '/tools/past-questions',
  },
  'study-timetable': {
    title: 'AI Study Timetable Generator',
    description: 'Generate a personalized AI-powered study timetable for your exams. Enter your subjects, exam date, and daily hours to get a custom study plan.',
    keywords: ['study timetable generator', 'AI study planner', 'exam preparation timetable', 'JAMB study plan', 'WAEC study schedule'],
    path: '/tools/study-timetable',
  },
  'daily-mentor': {
    title: 'Daily Mentor – AI Motivation',
    description: 'Start your day with a personalized motivational message and a daily study goal from Mentor Florryshine. Get inspired every morning.',
    keywords: ['daily mentor', 'motivation for students', 'AI motivation', 'study motivation', 'daily goal', 'Mentor Florryshine'],
    path: '/tools/daily-mentor',
  },
};