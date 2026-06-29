import { generateToolMetadata, toolsSEO } from '@/lib/seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import JAMBAggregateClient from './JAMBAggregateClient';

export const metadata = generateToolMetadata(toolsSEO['jamb-aggregate']);

export default function JAMBAggregatePage() {
  return (
    <>
      <Navbar />
      <JAMBAggregateClient />
      <Footer />
    </>
  );
}