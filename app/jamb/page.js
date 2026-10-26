import JAMBUniverse from '@/components/JAMBUniverse';

export const metadata = {
  title: 'JAMB 2027 Preparation: CBT Practice, Past Questions & Study Tools',
  description: 'Prepare for JAMB UTME 2027 with Shiney Brain Academy. Practise CBT questions, revise key topics, use study tools and build a consistent plan for your target score.',
  keywords: [
    'JAMB 2027',
    'JAMB UTME 2027 preparation',
    'JAMB CBT practice',
    'JAMB past questions',
    'JAMB study plan',
    'JAMB exam preparation Nigeria',
    'Shiney Brain Academy',
  ],
  alternates: { canonical: 'https://shineybrainacademy.vercel.app/jamb' },
  openGraph: {
    title: 'JAMB 2027 Preparation | Shiney Brain Academy',
    description: 'Practise, revise and prepare for JAMB UTME 2027 with exam resources and study tools for Nigerian students.',
    url: 'https://shineybrainacademy.vercel.app/jamb',
    type: 'website',
  },
};

export default function Page() {
  return <JAMBUniverse />;
}
