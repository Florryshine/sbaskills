import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CGPACalculatorClient from './CGPACalculatorClient';

export const metadata = generateToolMetadata(toolsSEO['cgpa-calculator']);

export default function CGPACalculatorPage() {
  return (
    <>
      <Navbar />
      <CGPACalculatorClient />
      <Footer />
    </>
  );
}