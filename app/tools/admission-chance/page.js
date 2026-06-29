import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AdmissionChanceClient from './AdmissionChanceClient';

export const metadata = generateToolMetadata(toolsSEO['admission-chance']);

export default function AdmissionChancePage() {
  return (
    <>
      <Navbar />
      <AdmissionChanceClient />
      <Footer />
    </>
  );
}