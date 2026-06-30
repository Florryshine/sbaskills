'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page used to write directly into the legacy `blog_posts` table,
// which is no longer read by the public blog. All post creation now goes
// through /admin/blog/add (writes to content_drafts, the single source of
// truth for both the admin list and the public /blog pages).
export default function LegacyNewBlogRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/blog/add');
  }, [router]);
  return <div className="p-6 text-gray-500">Redirecting to the new post editor…</div>;
}
