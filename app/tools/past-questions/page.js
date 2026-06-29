import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PastQuestionsClient from './PastQuestionsClient';

export const metadata = generateToolMetadata(toolsSEO['past-questions']);

export default function PastQuestionsPage() {
  return (
    <>
      <Navbar />
      <PastQuestionsClient />
      <Footer />
    </>
  );
}