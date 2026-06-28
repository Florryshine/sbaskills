import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

const tools = [
  {
    href: '/tools/study-timetable',
    icon: '📅',
    title: 'Study Timetable Generator',
    description: 'AI-powered personalized weekly study plan based on your subjects, exam date, and available hours.',
    badge: 'AI',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  {
    href: '/tools/jamb-aggregate',
    icon: '🎯',
    title: 'JAMB Aggregate Calculator',
    description: 'Calculate your JAMB + Post-UTME aggregate score to know your chances of admission.',
    badge: null,
  },
  {
    href: '/tools/cgpa-calculator',
    icon: '📊',
    title: 'CGPA Calculator',
    description: 'Compute your Cumulative GPA accurately using your course units and grades.',
    badge: null,
  },
  {
    href: '/tools/cut-off-mark',
    icon: '✂️',
    title: 'Cut-Off Mark Checker',
    description: 'Find the cut-off marks for your chosen university and course.',
    badge: null,
  },
  {
    href: '/tools/admission-chance',
    icon: '🎓',
    title: 'Admission Chance Estimator',
    description: 'Estimate your probability of getting admitted based on your scores and school preference.',
    badge: 'AI',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  {
    href: '/tools/subject-combination',
    icon: '📚',
    title: 'Subject Combination Checker',
    description: 'Find the correct O\'Level and JAMB subject combinations for any course and university.',
    badge: null,
  },
  {
    href: '/tools/waec-grade-calculator',
    icon: '🧮',
    title: 'WAEC Grade Calculator',
    description: 'Convert your WAEC raw scores to grades and check if you meet admission requirements.',
    badge: null,
  },
  {
    href: '/tools/past-questions',
    icon: '📝',
    title: 'Past Questions Practice',
    description: 'Practice JAMB and Post-UTME past questions by subject and year to boost your score.',
    badge: 'Popular',
    badgeColor: 'bg-green-100 text-green-700',
  },
  {
    href: '/tools/daily-mentor',
    icon: '🌟',
    title: 'Daily Mentor',
    description: 'Get daily AI-powered motivational tips, study advice, and exam strategies.',
    badge: 'AI',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
];

export default function ToolsPage() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <div className="bg-[#1e3a5f] text-white py-12 px-4 text-center">
        <div className="text-4xl mb-3">🛠️</div>
        <h1 className="text-3xl font-bold mb-2">Student Tools</h1>
        <p className="text-blue-200 max-w-xl mx-auto text-sm">
          Free tools built for Nigerian students — from JAMB prep to admission calculations. All in one place.
        </p>
      </div>

      {/* Tools Grid */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition-all group flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{tool.icon}</span>
                {tool.badge && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tool.badgeColor}`}>
                    {tool.badge}
                  </span>
                )}
              </div>
              <h2 className="font-bold text-[#1e3a5f] text-base mb-1 group-hover:text-blue-700 transition-colors">
                {tool.title}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed flex-1">{tool.description}</p>
              <div className="mt-4 text-blue-600 text-sm font-medium group-hover:underline">
                Open tool →
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 bg-[#1e3a5f] text-white rounded-2xl p-8 text-center">
          <p className="text-lg font-bold mb-1">Need more study help?</p>
          <p className="text-blue-200 text-sm mb-4">Join Shiney Brain Academy for full courses, live classes, and expert mentorship.</p>
          <Link
            href="/courses"
            className="inline-block bg-[#f0a500] text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-[#d4920a] transition-colors"
          >
            Browse Courses
          </Link>
        </div>
      </div>

      <Footer />
    </>
  );
}