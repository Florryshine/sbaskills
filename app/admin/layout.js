'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useEffect, useState } from "react";

export default function AdminLayout({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      // Add your admin email here
      const adminEmails = ["your-email@example.com"]; // CHANGE THIS TO YOUR EMAIL
      if (!adminEmails.includes(user.email)) {
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Header */}
      <header className="bg-blue-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/admin" className="text-xl font-bold">
            Shiney Brain Academy Admin
          </Link>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm"
          >
            Log Out
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-md min-h-screen p-4">
          <nav>
            <ul className="space-y-2">
              <li>
                <Link href="/admin" className="block px-3 py-2 rounded hover:bg-gray-100">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/admin/courses" className="block px-3 py-2 rounded hover:bg-gray-100">
                  Courses
                </Link>
              </li>
              <li>
                <Link href="/admin/students" className="block px-3 py-2 rounded hover:bg-gray-100">
                  Students
                </Link>
              </li>
              <li>
                <Link href="/admin/settings" className="block px-3 py-2 rounded hover:bg-gray-100">
                  Settings
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
    }
