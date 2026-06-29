import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WAECGradeClient from './WAECGradeClient';

export const metadata = generateToolMetadata(toolsSEO['waec-grade-calculator']);

export default function WAECGradePage() {
  return (
    <>
      <Navbar />
      <WAECGradeClient />
      <Footer />
    </>
  );
}