import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SubjectCombinationClient from './SubjectCombinationClient';

export const metadata = generateToolMetadata(toolsSEO['subject-combination']);

export default function SubjectCombinationPage() {
  return (
    <>
      <Navbar />
      <SubjectCombinationClient />
      <Footer />
    </>
  );
}