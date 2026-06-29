import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DailyMentorClient from './DailyMentorClient';

export const metadata = generateToolMetadata(toolsSEO['daily-mentor']);

export default function DailyMentorPage() {
  return (
    <>
      <Navbar />
      <DailyMentorClient />
      <Footer />
    </>
  );
}