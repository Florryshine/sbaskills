import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AdmissionChanceChecker from './AdmissionChanceChecker';

export const metadata = generateToolMetadata(toolsSEO['admission-chance']);

export default function AdmissionChanceCheckerPage() {
  return (
    <>
      <Navbar />
      <AdmissionChanceChecker />
      <Footer />
    </>
  );
}