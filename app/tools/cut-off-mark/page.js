import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CutOffMarkClient from './CutOffMarkClient';

export const metadata = generateToolMetadata(toolsSEO['cut-off-mark']);

export default function CutOffMarkPage() {
  return (
    <>
      <Navbar />
      <CutOffMarkClient />
      <Footer />
    </>
  );
}