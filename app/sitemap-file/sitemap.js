import { createServerClient } from '@/lib/supabase-server';
import { BASE_URL } from '@/lib/seo';

export default async function sitemap() {
  const baseUrl = BASE_URL;
  const supabase = createServerClient();

  // Get all published blog posts
  const { data: posts } = await supabase
    .from('content_drafts')
    .select('url_slug, updated_at, published_at')
    .eq('status', 'published');

  // Static pages
  const staticPages = [
    { url: baseUrl, priority: 1.0 },
    { url: `${baseUrl}/courses`, priority: 0.8 },
    { url: `${baseUrl}/blog`, priority: 0.9 },
    { url: `${baseUrl}/audio`, priority: 0.7 },
    { url: `${baseUrl}/library`, priority: 0.7 },
    { url: `${baseUrl}/leaderboard`, priority: 0.6 },
    { url: `${baseUrl}/rewards`, priority: 0.6 },
    { url: `${baseUrl}/about`, priority: 0.5 },
    { url: `${baseUrl}/contact`, priority: 0.5 },
  ];

  // Blog post pages
  const blogPages = (posts || []).map((post) => ({
    url: `${baseUrl}/blog/${post.url_slug}`,
    lastModified: post.updated_at || post.published_at || new Date(),
    priority: 0.8,
  }));

  return [...staticPages, ...blogPages];
}