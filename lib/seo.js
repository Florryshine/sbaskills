// lib/seo.js
export const BASE_URL = 'https://shineybrainacademy.vercel.app';

export function generateToolMetadata({ title, description, path, keywords = [], image = '/logo.png' }) {
  const baseUrl = BASE_URL;
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
    title: 'JAMB Aggregate Score Calculator for Nigerian Universities',
    description: 'Calculate your estimated university admission aggregate from your UTME score and O’Level grades. Explore JAMB aggregate calculations and admission requirements for Nigerian universities; results are estimates, not admission guarantees.',
    keywords: ['JAMB aggregate calculator', 'JAMB score calculator', 'university aggregate calculator Nigeria', 'JAMB and WAEC aggregate', 'UNILAG aggregate calculator', 'OAU aggregate calculator', 'UNIBEN aggregate calculator', 'admission score calculator'],
    path: '/tools/jamb-aggregate',
  },
  'waec-grade-calculator': {
    title: 'WAEC Grade Calculator and O’Level Results Checker',
    description: 'Calculate and review WAEC subject grades, grade points and overall performance. Use your results to identify strong subjects, plan revision and prepare your O’Level grades for admission research.',
    keywords: ['WAEC grade calculator', 'WAEC grading system', 'WAEC grade points', 'O Level grade calculator', 'WAEC results calculator', 'WAEC aggregate calculator', 'calculate WAEC grades'],
    path: '/tools/waec-grade-calculator',
  },
  'cgpa-calculator': {
    title: 'CGPA Calculator for Nigerian University Students',
    description: 'Calculate your cumulative grade point average (CGPA) from semester results, course grades and credit units. Track GPA, understand your academic standing and estimate the CGPA you need to reach your target classification.',
    keywords: ['CGPA calculator', 'GPA calculator Nigeria', 'Nigerian university CGPA calculator', 'calculate CGPA by credit units', 'semester GPA calculator', 'how to calculate CGPA', 'improve CGPA'],
    path: '/tools/cgpa-calculator',
  },
  'subject-combination': {
    title: 'JAMB Subject Combination Checker for Courses in Nigeria',
    description: 'Find the UTME subject combination and O’Level requirements for courses such as Medicine, Nursing, Law, Engineering, Accounting, Computer Science and Education. Check course requirements before choosing subjects and verify details with the current JAMB brochure and your institution.',
    keywords: ['JAMB subject combination', 'JAMB subject combination for courses', 'subject combination checker', 'Medicine JAMB subject combination', 'Nursing JAMB subject combination', 'Law JAMB subject combination', 'Engineering JAMB subject combination', 'Computer Science JAMB subject combination', 'O Level requirements for courses'],
    path: '/tools/subject-combination',
  },
  'admission-chance': {
    title: 'University Admission Chance Checker for Nigeria',
    description: 'Estimate your admission readiness using your UTME score, O’Level results, chosen course and preferred institution. Explore factors that may affect admission and identify requirements to verify before applying. Predictions are guidance only, not official decisions or guarantees.',
    keywords: ['admission chance checker', 'JAMB admission chance', 'admission calculator Nigeria', 'check my admission chances', 'university admission predictor', 'JAMB score admission chance', 'admission requirements checker', 'admission probability'],
    path: '/tools/admission-chance',
  },
  'cut-off-mark': {
    title: 'JAMB Cut-off Mark Checker for Nigerian Schools and Courses',
    description: 'Research JAMB, university, departmental and course cut-off marks for Nigerian universities, polytechnics and colleges of education. Compare admission requirements by institution and course, then confirm the latest figures through official school announcements.',
    keywords: ['JAMB cut off mark', 'university cut off marks Nigeria', 'departmental cut off mark', 'cut off mark checker', 'JAMB cut off mark by school', 'UNILAG cut off mark', 'UNIBEN cut off mark', 'OAU cut off mark', 'Nursing cut off mark Nigeria', 'Medicine cut off mark Nigeria'],
    path: '/tools/cut-off-mark',
  },
  'past-questions': {
    title: 'JAMB, WAEC, NECO and Post-UTME Past Question Search',
    description: 'Find exam practice by subject, topic and examination type for JAMB UTME, WAEC, NECO and Post-UTME. Use past-question practice to test understanding, revise key topics, identify weak areas and prepare for computer-based tests.',
    keywords: ['JAMB past questions', 'JAMB questions and answers', 'WAEC past questions', 'NECO past questions', 'Post UTME past questions', 'CBT practice questions', 'exam questions and answers', 'past question search by subject'],
    path: '/tools/past-questions',
  },
  'study-timetable': {
    title: 'Study Timetable Generator for Exam Preparation',
    description: 'Create a personalised study timetable based on your subjects, available study hours, weak topics and exam goals. Organise revision, practice questions, breaks and review sessions into a realistic study routine.',
    keywords: ['study timetable generator', 'study timetable maker', 'exam study planner', 'personalised study schedule', 'JAMB study timetable', 'WAEC study timetable', 'daily study plan for students', 'AI study planner'],
    path: '/tools/study-timetable',
  },
  'daily-mentor': {
    title: 'Daily Study Motivation and Goals for Students',
    description: 'Build a steady study habit with daily encouragement, practical learning goals and motivation from Mentor Florryshine. Get ideas to stay focused, revise consistently and keep moving towards your academic goals.',
    keywords: ['study motivation for students', 'daily study goals', 'student motivation', 'study habits', 'Mentor Florryshine', 'daily learning motivation'],
    path: '/tools/daily-mentor',
  },
};

// ─── Blog post metadata (used by app/blog/[slug]/page.js generateMetadata) ──
// Every published post needs its OWN title/description/canonical/OG tags —
// without this, every post falls back to the generic site-wide metadata in
// app/layout.js and Google shows identical titles/snippets for every post.
export function generateBlogPostMetadata(post) {
  const url = `${BASE_URL}/blog/${post.url_slug}`;
  const description =
    post.meta_description ||
    'Read this article on Shiney Brain Academy — JAMB, WAEC and NECO study help for Nigerian students.';
  const image = post.cover_image || `${BASE_URL}/logo.png`;
  const publishedTime = post.published_at || post.created_at || undefined;
  const modifiedTime = post.updated_at || publishedTime;

  return {
    title: post.title,
    description,
    keywords: [post.subject, 'JAMB', 'WAEC', 'NECO', 'Shiney Brain Academy'].filter(Boolean).join(', '),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: post.title,
      description,
      url,
      type: 'article',
      publishedTime,
      modifiedTime,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [image],
    },
  };
}