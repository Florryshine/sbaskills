import { createServerClient } from '@/lib/supabase-server';

export default async function sitemap() {
  const baseUrl = 'https://sbaskills.vercel.app';
  const supabase = createServerClient();

  // Get all published blog posts
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, updated_at')
    .eq('published', true);

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
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updated_at || new Date(),
    priority: 0.8,
  }));

  return [...staticPages, ...blogPages];
}