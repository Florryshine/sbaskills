'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function BlogAdminPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      alert('Error loading posts: ' + error.message);
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  }

  async function deletePost(id) {
    if (!confirm('Delete this post permanently?')) return;
    const { error } = await supabase
      .from('content_drafts')
      .delete()
      .eq('id', id);
    if (error) {
      alert('Delete failed: ' + error.message);
    } else {
      fetchPosts(); // refresh list
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📝 Blog Posts</h1>
        <Link
          href="/admin/blog/add"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Write New Post
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No published posts yet.</p>
          <p className="text-sm text-gray-400 mt-2">Create your first post using the "Write New Post" button.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-gray-500">Title</th>
                <th className="text-left p-3 text-sm font-medium text-gray-500">Slug</th>
                <th className="text-left p-3 text-sm font-medium text-gray-500">Category</th>
                <th className="text-left p-3 text-sm font-medium text-gray-500">Published</th>
                <th className="text-right p-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <Link
                      href={`/blog/${post.url_slug}`}
                      target="_blank"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="p-3 text-sm text-gray-500">{post.url_slug}</td>
                  <td className="p-3 text-sm text-gray-500">{post.category || 'Uncategorized'}</td>
                  <td className="p-3 text-sm text-gray-500">
                    {post.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/blog/${post.id}/edit`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deletePost(post.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}