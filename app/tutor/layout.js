'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TutorLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [isTutor, setIsTutor] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['tutor', 'admin'].includes(profile.role)) {
        router.push('/dashboard');
        return;
      }

      setIsTutor(true);
      setLoading(false);
    }

    checkRole();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-2">⏳</p>
          <p className="text-gray-500">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isTutor) return null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}