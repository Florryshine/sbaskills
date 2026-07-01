'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function Comments({ postId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
    fetchComments();
  }, [postId, sort]);

  async function fetchComments() {
    setLoading(true);
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles:user_id (full_name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: sort === 'oldest' });
    if (!error) setComments(data || []);
    setLoading(false);
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    const supabase = createBrowserClient();
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: user?.id,
      content: newComment.trim(),
    });
    if (!error) {
      setNewComment('');
      fetchComments();
    }
  }

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="font-bold mb-4">Comments ({comments.length})</h3>
      
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm text-gray-600">Sort by:</label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      {user ? (
        <form onSubmit={submitComment} className="mb-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full border rounded p-2 text-sm"
            rows="2"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded text-sm">
            Post
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-500">Please log in to comment.</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="border-b pb-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{c.profiles?.full_name || 'Anonymous'}</span>
                <span className="text-gray-400 text-xs">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}