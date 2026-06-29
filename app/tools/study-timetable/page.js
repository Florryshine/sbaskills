import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StudyTimetableClient from './StudyTimetableClient';

export const metadata = generateToolMetadata(toolsSEO['study-timetable']);

export default function StudyTimetablePage() {
  return (
    <>
      <Navbar />
      <StudyTimetableClient />
      <Footer />
    </>
  );
}