import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function ToolsPage() {
  return (
    <>
      <Navbar />
      <div className="p-8">
        <h1 className="text-2xl font-bold">Tools</h1>
        <p>List of tools here...</p>
      </div>
      <Footer />
    </>
  );
}