'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import SortSelect from '@/components/SortSelect';

export const dynamic = 'force-dynamic';

export default function BlogPage({ searchParams }) {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(searchParams?.category || 'All');
  const [sort, setSort] = useState(searchParams?.sort || 'newest');
  const [search, setSearch] = useState(searchParams?.search || '');

  const supabase = createBrowserClient();

  useEffect(() => {
    fetchPostsAndCategories();
  }, [selectedCategory, sort, search]);

  async function fetchPostsAndCategories() {
    setLoading(true);

    // ── Fetch all published posts ────────────────────────────
    let query = supabase
      .from('content_drafts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: sort === 'oldest' });

    if (selectedCategory !== 'All') {
      query = query.eq('category', selectedCategory);
    }

    if (search.trim()) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: postsData, error } = await query;
    if (!error) setPosts(postsData || []);

    // ── Fetch category counts ────────────────────────────────
    const { data: categoryData, error: catError } = await supabase
      .from('content_drafts')
      .select('category')
      .eq('status', 'published');

    if (!catError && categoryData) {
      const counts = {};
      categoryData.forEach((p) => {
        const cat = p.category || 'Uncategorized';
        counts[cat] = (counts[cat] || 0) + 1;
      });
      const catList = Object.keys(counts).map((name) => ({
        name,
        count: counts[name],
      }));
      catList.sort((a, b) => b.count - a.count);
      setCategories([{ name: 'All', count: postsData?.length || 0 }, ...catList]);
    }

    setLoading(false);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">📝 Blog</h1>

          {/* ─── Filters ─── */}
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat.name
                    ? 'bg-[#1a73e8] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              placeholder="Search articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            />
            <SortSelect sort={sort} />
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No published posts found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.url_slug}`}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden border border-gray-100"
                >
                  {post.cover_image && (
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h2 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {post.title}
                    </h2>
                    {post.meta_description && (
                      <p className="text-sm text-gray-600 line-clamp-3 mt-1">
                        {post.meta_description}
                      </p>
                    )}
                    <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                      <span>{post.category || 'General'}</span>
                      <span>
                        {new Date(post.published_at || post.created_at).toLocaleDateString('en-NG', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}