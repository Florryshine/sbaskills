export default async function sitemap() {
  const baseUrl = 'https://sbaskills-mwzr.vercel.app';
  
  // Static pages
  const routes = ['', '/courses', '/blog', '/audio', '/leaderboard', '/library', '/about', '/contact', '/login', '/register'].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1.0 : 0.8,
  }));

  // Optional: Fetch dynamic blog posts, courses, books from Supabase
  // const supabase = createServerClient();
  // const { data: posts } = await supabase.from('blog_posts').select('slug');
  // const blogRoutes = posts.map(post => ({ url: `${baseUrl}/blog/${post.slug}`, ... }));

  return routes;
}
