import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { generateToolMetadata } from '@/lib/seo';

export const metadata = generateToolMetadata({
  title: 'Student Tools Hub',
  description: 'Free educational tools for Nigerian students: JAMB aggregate calculator, WAEC grade calculator, CGPA calculator, past question search, and AI study planner.',
  path: '/tools',
  keywords: ['student tools', 'JAMB tools', 'WAEC tools', 'calculator', 'study tools', 'Nigerian students'],
});

const tools = [
  // ── Academic Tools ──
  {
    name: 'JAMB Aggregate Calculator',
    description: 'Calculate your JAMB aggregate score from your JAMB and WAEC grades.',
    icon: '🎯',
    href: '/tools/jamb-aggregate',
    category: 'Academic',
    popular: true,
  },
  {
    name: 'WAEC Grade Calculator',
    description: 'Convert your WAEC grades to points and see your performance.',
    icon: '📊',
    href: '/tools/waec-grade-calculator',
    category: 'Academic',
    popular: true,
  },
  {
    name: 'CGPA Calculator',
    description: 'Calculate your university CGPA semester by semester.',
    icon: '🎓',
    href: '/tools/cgpa-calculator',
    category: 'Academic',
  },
  {
    name: 'Subject Combination Checker',
    description: 'Check the correct JAMB subject combination for any course.',
    icon: '📚',
    href: '/tools/subject-combination',
    category: 'Academic',
    popular: true,
  },
  {
    name: 'Admission Chance Checker',
    description: 'Predict your admission chance based on your scores and school.',
    icon: '🔮',
    href: '/tools/admission-chance',
    category: 'Academic',
    popular: true,
  },
  {
    name: 'Cut-off Mark Checker',
    description: 'Search for cut-off marks of schools and courses.',
    icon: '📉',
    href: '/tools/cut-off-mark',
    category: 'Academic',
  },
  {
    name: 'Past Question Search',
    description: 'Search for past questions by subject, year, and exam type.',
    icon: '📝',
    href: '/tools/past-questions',
    category: 'Academic',
    popular: true,
  },

  // ── Study & AI Tools ──
  {
    name: 'Study Timetable Generator',
    description: 'Get a personalized study timetable for your exam.',
    icon: '📅',
    href: '/tools/study-timetable',
    category: 'Study',
    popular: true,
    ai: true,
  },
  {
    name: 'Daily Mentor',
    description: 'Start your day with motivation and a goal from Shine Mentor.',
    icon: '🌞',
    href: '/tools/daily-mentor',
    category: 'Study',
    ai: true,
  },

  // ── Engagement / Games ──
  {
    name: 'Daily Challenge',
    description: 'Test your knowledge with a new quiz every day. Earn XP and streak!',
    icon: '⚡',
    href: '/challenge',
    category: 'Games',
    popular: true,
  },
  {
    name: 'Boss Battles',
    description: 'Defeat exam-topic bosses by answering questions correctly.',
    icon: '👹',
    href: '/boss',
    category: 'Games',
    popular: true,
  },
  {
    name: 'Achievements',
    description: 'Collect badges by completing challenges and defeating bosses.',
    icon: '🏆',
    href: '/achievements',
    category: 'Games',
  },
];

const categories = ['Academic', 'Study', 'Games'];

export default function ToolsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-brand-blue">
              🛠️ Student Tools Hub
            </h1>
            <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
              Free tools, calculators, and games to help you learn, practice, and stay motivated.
            </p>
          </div>

          {categories.map((category) => {
            const filtered = tools.filter(t => t.category === category);
            if (filtered.length === 0) return null;
            return (
              <div key={category} className="mb-12">
                <h2 className="text-2xl font-extrabold text-brand-blue mb-6 border-b pb-2">
                  {category}
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition hover:border-brand-yellow group relative"
                    >
                      {tool.popular && (
                        <span className="absolute top-3 right-3 text-xs bg-brand-yellow/20 text-brand-dark px-2 py-0.5 rounded-full font-bold">
                          ⭐ Popular
                        </span>
                      )}
                      {tool.ai && (
                        <span className="absolute top-3 right-3 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                          🤖 AI
                        </span>
                      )}
                      <div className="text-4xl mb-3">{tool.icon}</div>
                      <h3 className="font-bold text-gray-800 group-hover:text-brand-blue transition">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-2">{tool.description}</p>
                      <span className="inline-block mt-4 text-brand-blue text-sm font-semibold group-hover:underline">
                        Use Tool →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </>
  );
}