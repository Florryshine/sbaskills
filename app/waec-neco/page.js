import WAECNECOUniverse from '@/components/WAECNECOUniverse';

export const metadata = {
  title: 'WAEC & NECO Preparation: Revision, Practice Questions and Study Help',
  description: 'Prepare for WAEC and NECO with Shiney Brain Academy. Review school subjects, practise exam questions, strengthen weak topics and organise your revision for theory and practical papers.',
  keywords: [
    'WAEC preparation',
    'NECO preparation',
    'WAEC past questions',
    'NECO past questions',
    'WAEC revision',
    'NECO exam practice',
    'study resources for Nigerian students',
    'Shiney Brain Academy',
  ],
  alternates: { canonical: 'https://shineybrainacademy.vercel.app/waec-neco' },
  openGraph: {
    title: 'WAEC and NECO Preparation | Shiney Brain Academy',
    description: 'Study, practise and revise for WAEC and NECO using exam preparation resources for Nigerian students.',
    url: 'https://shineybrainacademy.vercel.app/waec-neco',
    type: 'website',
  },
};

export default function Page() {
  return <WAECNECOUniverse />;
}
