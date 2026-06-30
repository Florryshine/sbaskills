'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

// This page used to edit rows directly in the legacy `blog_posts` table.
// All blog editing now happens against content_drafts via /admin/blog/[id]/edit,
// which is what the public /blog pages and the admin list actually read from.
export default function LegacyEditBlogRedirect() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(`/admin/blog/${params.id}/edit`);
  }, [router, params.id]);
  return <div className="p-6 text-gray-500">Redirecting to the post editor…</div>;
}
