import UniversePage from '@/components/UniversePage';

export const metadata = {
  title: 'Post-UTME Preparation Nigeria: Screening Practice & Admission Help',
  description: 'Prepare for Post-UTME and university screening in Nigeria. Find study support, practise exam questions, review admission requirements and plan for your chosen institution with Shiney Brain Academy.',
  keywords: [
    'Post-UTME preparation',
    'Post UTME past questions',
    'university screening exam Nigeria',
    'Post-UTME practice questions',
    'admission requirements Nigeria',
    'university admission preparation',
    'Shiney Brain Academy',
  ],
  alternates: { canonical: 'https://shineybrainacademy.vercel.app/post-utme' },
  openGraph: {
    title: 'Post-UTME Preparation and Screening Help | Shiney Brain Academy',
    description: 'Prepare for Nigerian university screening with practice, study support and admission guidance.',
    url: 'https://shineybrainacademy.vercel.app/post-utme',
    type: 'website',
  },
};

export default function Page() {
  return <UniversePage slug="POST_UTME" />;
}
