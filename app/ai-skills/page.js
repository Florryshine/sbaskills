import UniversePage from '@/components/UniversePage';

export const metadata = {
  title: 'Learn AI and Digital Skills Online | Shiney Brain Academy',
  description: 'Explore AI tools, digital skills, technology, creative skills and career learning resources with Shiney Brain Academy. Find practical learning pathways for students and beginners in Nigeria.',
  keywords: [
    'learn AI tools',
    'digital skills for students',
    'AI skills for beginners',
    'technology skills Nigeria',
    'online digital skills learning',
    'creative and career skills',
    'Shiney Brain Academy',
  ],
  alternates: { canonical: 'https://shineybrainacademy.vercel.app/ai-skills' },
  openGraph: {
    title: 'AI and Digital Skills Learning | Shiney Brain Academy',
    description: 'Explore practical AI, technology, creative and career skills for students and beginners.',
    url: 'https://shineybrainacademy.vercel.app/ai-skills',
    type: 'website',
  },
};

export default function Page() {
  return <UniversePage slug="AI_SKILLS" />;
}
