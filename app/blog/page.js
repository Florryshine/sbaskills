import { createServerClient } from '@/lib/supabase-server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import SortSelect from '@/components/SortSelect';

// ─── Metadata ───────────────────────────────────────────────
export async function generateMetadata({ searchParams }) {
  const category = searchParams?.category || 'all';
  const search = searchParams?.search || '';

  let title = 'Blog | Shiney Brain Academy';
  let description = 'Read the latest tips, study guides, and exam preparation advice for Nigerian students.';

  if (category !== 'all') {
    const categoryNames = {
      jamb: 'JAMB',
      waec: 'WAEC',
      neco: 'NECO',
      'post-utme': 'Post-UTME',
      'digital-skills': 'Digital Skills',
      'study-tips': 'Study Tips',
      career: 'Career'
    };
    title = `${categoryNames[category] || category} Posts | Shiney Brain Academy`;
    description = `Read ${categoryNames[category] || category} exam tips, study guides, and preparation advice.`;
  }

  if (search) {
    title = `Search: ${search} | Shiney Brain Academy`;
    description = `Search results for "${search}" on Shiney Brain Academy.`;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://shineybrainacademy.vercel.app/blog${searchParams?.category ? `?category=${searchParams.category}` : ''}`,
      type: 'website',
    },
  };
}

// ─── Helper ─────────────────────────────────────────────────
function getReadingTime(content) {
  const wordsPerMinute = 200;
  const wordCount = content?.split(/\s+/).length || 0;
  return Math.ceil(wordCount / wordsPerMinute);
}

// ─── Page Component ────────────────────────────────────────
export default async function BlogPage({ searchParams }) {
  const supabase = createServerClient();

  // Get filter params
  const category = searchParams?.category || 'all';
  const search = searchParams?.search || '';
  const sort = searchParams?.sort || 'newest';
  const page = parseInt(searchParams?.page) || 1;
  const pageSize = 9;

  // Build query
  let query = supabase
    .from('content_drafts')
    .select(`
      id,
      title,
      url_slug,
      meta_description,
      cover_image,
      published_at,
      created_at,
      content,
      category
    `)
    .eq('status', 'published');

  // Category filter
  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  // Search filter
  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  // Sorting
  if (sort === 'oldest') {
    query = query.order('published_at', { ascending: true });
  } else if (sort === 'popular') {
    // This would require a views/comments count column – we'll use created_at as fallback
    query = query.order('created_at', { ascending: false });
  } else {
    // Newest by default
    query = query.order('published_at', { ascending: false });
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  // Get total count for pagination
  const { count: totalPosts } = await supabase
    .from('content_drafts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  const { data: posts } = await query;

  // Get real per-category counts (published posts only)
  const { data: categoryRows } = await supabase
    .from('content_drafts')
    .select('category')
    .eq('status', 'published');

  const categoryCounts = (categoryRows || []).reduce((acc, row) => {
    if (row.category) acc[row.category] = (acc[row.category] || 0) + 1;
    return acc;
  }, {});

  // Get comment counts for each post
  const postIds = posts?.map(p => p.id) || [];
  let commentCounts = {};
  if (postIds.length > 0) {
    const { data: comments } = await supabase
      .from('blog_comments')
      .select('post_id')
      .in('post_id', postIds)
      .eq('is_approved', true);
    if (comments) {
      commentCounts = comments.reduce((acc, c) => {
        acc[c.post_id] = (acc[c.post_id] || 0) + 1;
        return acc;
      }, {});
    }
  }

  // Categories for filter
  const categories = [
    { slug: 'all', label: 'All Posts', count: totalPosts || 0 },
    { slug: 'jamb', label: 'JAMB', count: categoryCounts['jamb'] || 0 },
    { slug: 'waec', label: 'WAEC', count: categoryCounts['waec'] || 0 },
    { slug: 'neco', label: 'NECO', count: categoryCounts['neco'] || 0 },
    { slug: 'study-tips', label: 'Study Tips', count: categoryCounts['study-tips'] || 0 },
    { slug: 'admission', label: 'Admission', count: categoryCounts['admission'] || 0 },
    { slug: 'digital-skills', label: 'Digital Skills', count: categoryCounts['digital-skills'] || 0 },
  ];

  const totalPages = Math.ceil((totalPosts || 0) / pageSize);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {/* ── Hero Section ── */}
        <section className="bg-brand-blue py-16 text-center text-white">
          <h1 className="text-4xl font-extrabold mb-3">📚 Shiney Brain Blog</h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            Tips, study guides and insights to help you ace JAMB, WAEC, NECO and beyond
          </p>
          <p className="text-sm text-blue-200 mt-4">
            {totalPosts || 0} articles • {categories.length} categories
          </p>
        </section>

        {/* ── Filters & Search ── */}
        <section className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/blog?category=${cat.slug}`}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    category === cat.slug
                      ? 'bg-brand-blue text-white'
                      : 'bg-white text-gray-600 hover:bg-brand-blue/10 border border-gray-200'
                  }`}
                >
                  {cat.label}
                  <span className="text-xs ml-1 opacity-60">({cat.count})</span>
                </Link>
              ))}
            </div>

            {/* Search & Sort */}
            <div className="flex flex-wrap gap-3 items-center">
              <form className="flex gap-2">
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Search articles..."
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-48"
                />
                <button
                  type="submit"
                  className="bg-brand-yellow text-brand-dark px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90"
                >
                  Search
                </button>
              </form>
              <SortSelect sort={sort} />
            </div>
          </div>
        </section>

        {/* ── Blog Posts Grid ── */}
        <section className="max-w-6xl mx-auto px-4 pb-12">
          {!posts || posts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <p className="text-5xl mb-4">✍️</p>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">No posts found</h2>
              <p className="text-gray-500">Try adjusting your search or filter.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => {
                  const readingTime = getReadingTime(post.content || '');
                  const commentCount = commentCounts[post.id] || 0;
                  const authorName = 'Shiney Brain Academy';

                  return (
                    <Link
                      key={post.id}
                      href={`/blog/${post.url_slug}`}
                      className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-100"
                    >
                      {/* Cover Image */}
                      <div className="relative h-48 overflow-hidden">
                        {post.cover_image ? (
                          <img
                            src={post.cover_image}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-brand-blue flex items-center justify-center text-5xl">
                            📖
                          </div>
                        )}
                        {/* Category Badge */}
                        {post.category && (
                          <span className="absolute top-3 left-3 bg-brand-yellow/90 text-brand-dark text-xs font-bold px-3 py-1 rounded-full">
                            {post.category.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <h2 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-brand-blue transition line-clamp-2">
                          {post.title}
                        </h2>

                        {/* Author & Date */}
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                          <span className="font-medium text-gray-600">{authorName}</span>
                          <span>•</span>
                          <span>
                            {new Date(post.published_at || post.created_at).toLocaleDateString('en-NG', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        {/* Excerpt */}
                        {post.meta_description && (
                          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                            {post.meta_description}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <div className="flex items-center gap-3">
                            <span>📖 {readingTime} min read</span>
                            <span>💬 {commentCount}</span>
                          </div>
                          <span className="text-brand-blue font-semibold group-hover:underline">
                            Read →
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={`/blog?page=${p}&category=${category}&search=${search}&sort=${sort}`}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                        p === page
                          ? 'bg-brand-blue text-white'
                          : 'bg-white text-gray-600 hover:bg-brand-blue/10 border border-gray-200'
                      }`}
                    >
                      {p}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Newsletter CTA ── */}
        <section className="bg-brand-yellow py-12">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-extrabold text-brand-dark mb-2">
              📩 Get Latest Posts in Your Inbox
            </h2>
            <p className="text-brand-dark/70 mb-4">
              Subscribe to get updates on new blog posts, exam tips, and resources.
            </p>
            <form className="flex max-w-md mx-auto gap-3">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 rounded-xl border border-brand-dark/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <button
                type="submit"
                className="bg-brand-blue text-white px-6 py-3 rounded-xl font-bold hover:opacity-90"
              >
                Subscribe
              </button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}