import UniversePage from '@/components/UniversePage';

export const metadata = {
  title: 'University Student Resources: CGPA, Study Tools & Skills',
  description: 'Explore study resources for Nigerian university students, including CGPA calculation, study planning, academic improvement, practical digital skills and preparation for life beyond admission.',
  keywords: [
    'resources for university students Nigeria',
    'CGPA calculator',
    'university study tips',
    'improve CGPA',
    'study planning for undergraduates',
    'digital skills for undergraduates',
    'Shiney Brain Academy',
  ],
  alternates: { canonical: 'https://shineybrainacademy.vercel.app/university' },
  openGraph: {
    title: 'University Student Resources | Shiney Brain Academy',
    description: 'Study tools, CGPA support and practical skills resources for Nigerian undergraduates.',
    url: 'https://shineybrainacademy.vercel.app/university',
    type: 'website',
  },
};

export default function Page() {
  return <UniversePage slug="UNIVERSITY" />;
}
