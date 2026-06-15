import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Simple Navbar (temporary) */}
      <nav className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">🧠 Shiney Brain Academy</Link>
        <div className="space-x-4">
          <Link href="/courses">Courses</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/audio">Audio</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/login">Login</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="text-center py-20 px-4">
        <h1 className="text-4xl font-bold text-blue-600">Welcome to Shiney Brain Academy</h1>
        <p className="mt-4 text-lg text-gray-600">Skills, Success & Academic Excellence</p>
        <div className="mt-8 space-x-4">
          <Link href="/register" className="bg-yellow-500 px-6 py-3 rounded-lg font-bold">Get Started</Link>
          <Link href="/courses" className="border border-blue-600 px-6 py-3 rounded-lg font-bold text-blue-600">Browse Courses</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 text-center p-6 text-gray-500">
        © 2025 Shiney Brain Academy. All rights reserved.
      </footer>
    </main>
  );
}