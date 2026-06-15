import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-blue-600 text-white p-4 flex justify-between">
        <span className="font-bold">Shiney Brain Academy</span>
        <div className="space-x-4">
          <Link href="/blog">Blog</Link>
          <Link href="/audio">Audio</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/login">Login</Link>
        </div>
      </nav>
      <main className="p-8 text-center">
        <h1 className="text-3xl font-bold">Welcome back!</h1>
        <p className="mt-4">Your site is rebuilding.</p>
      </main>
    </div>
  );
}