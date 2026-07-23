import { createServerClient } from '@/lib/supabase-server';
import { BASE_URL } from '@/lib/seo';

export default async function sitemap() {
  const baseUrl = BASE_URL;
  const supabase = createServerClient();

  const { data: posts } = await supabase
    .from('content_drafts')
    .select('url_slug, updated_at, published_at')
    .eq('status', 'published');

  // Static pages — now with lastModified
  const staticPages = [
    { url: baseUrl, priority: 1.0, lastModified: new Date() },
    { url: `${baseUrl}/courses`, priority: 0.8, lastModified: new Date() },
    { url: `${baseUrl}/blog`, priority: 0.9, lastModified: new Date() },
    { url: `${baseUrl}/audio`, priority: 0.7, lastModified: new Date() },
    { url: `${baseUrl}/library`, priority: 0.7, lastModified: new Date() },
    { url: `${baseUrl}/leaderboard`, priority: 0.6, lastModified: new Date() },
    { url: `${baseUrl}/rewards`, priority: 0.6, lastModified: new Date() },
    { url: `${baseUrl}/about`, priority: 0.5, lastModified: new Date() },
    { url: `${baseUrl}/contact`, priority: 0.5, lastModified: new Date() },
  ];

  // Dedupe by url_slug — keep the most recently updated version if duplicates exist
  const seen = new Map();
  for (const post of posts || []) {
    if (!post.url_slug) continue;
    const existing = seen.get(post.url_slug);
    const postDate = new Date(post.updated_at || post.published_at || 0);
    if (!existing || postDate > new Date(existing.updated_at || existing.published_at || 0)) {
      seen.set(post.url_slug, post);
    }
  }

  const blogPages = Array.from(seen.values()).map((post) => ({
    url: `${baseUrl}/blog/${post.url_slug}`,
    lastModified: post.updated_at || post.published_at || new Date(),
    priority: 0.8,
  }));

  return [...staticPages, ...blogPages];
}