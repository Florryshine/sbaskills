'use client';

import { useEffect, useState, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function CertificatePage() {
  const [certificate, setCertificate] = useState(null);
  const [student, setStudent] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();
  const certificateRef = useRef(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadCertificate() {
      const { data: cert } = await supabase
        .from('certificates')
        .select('*')
        .eq('id', id)
        .single();

      if (cert) {
        setCertificate(cert);

        const { data: studentData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', cert.student_id)
          .single();
        setStudent(studentData);

        const { data: courseData } = await supabase
          .from('courses')
          .select('*')
          .eq('id', cert.course_id)
          .single();
        setCourse(courseData);
      }
      setLoading(false);
    }
    loadCertificate();
  }, [id, supabase]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center">Loading certificate...</div>
      <Footer />
    </>
  );

  if (!certificate) return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center">Certificate not found</div>
      <Footer />
    </>
  );

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-6 no-print">
            <button
              onClick={handlePrint}
              className="bg-brand-blue text-white px-6 py-3 rounded-full font-bold hover:opacity-90"
            >
              🖨️ Print / Save as PDF
            </button>
          </div>

          {/* Certificate */}
          <div
            ref={certificateRef}
            className="bg-white rounded-2xl shadow-2xl border-4 border-brand-yellow p-12 text-center print:p-8"
            style={{ minHeight: '500px' }}
          >
            <div className="border-2 border-brand-blue/20 rounded-xl p-8">
              <div className="border-t-4 border-brand-yellow w-32 mx-auto mb-6" />

              <p className="text-sm font-bold uppercase tracking-[0.3em] text-brand-blue">
                Shiney Brain Academy
              </p>

              <h1 className="text-4xl font-black text-brand-blue mt-6 mb-2">
                🎓 Certificate of Completion
              </h1>

              <p className="text-gray-600 text-sm mb-8">This certifies that</p>

              <p className="text-3xl font-bold text-brand-dark mb-2">
                {student?.full_name || 'Student'}
              </p>

              <p className="text-gray-600 text-sm mt-4 mb-2">
                has successfully completed the course
              </p>

              <p className="text-2xl font-bold text-brand-blue">
                {course?.title}
              </p>

              <p className="text-gray-500 text-xs mt-6">
                Certificate Number: {certificate.certificate_number}
              </p>

              <div className="flex justify-between items-center mt-10 pt-6 border-t border-gray-200">
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-500">Date Issued</p>
                  <p className="text-sm font-semibold">
                    {new Date(certificate.issued_at).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-500">Issued By</p>
                  <p className="text-sm font-semibold text-brand-blue">Shiney Brain Academy</p>
                </div>
              </div>

              <div className="mt-6 border-t-2 border-brand-yellow w-24 mx-auto" />
            </div>
          </div>
        </div>

        {/* Print styles */}
        <style jsx>{`
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              background: white;
            }
            .print\\:p-8 {
              padding: 2rem;
            }
          }
        `}</style>
      </main>
      <Footer />
    </>
  );
}