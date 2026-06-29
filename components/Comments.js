'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Comments({ postId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadComments() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data } = await supabase
        .from('blog_comments')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq('post_id', postId)
        .eq('is_approved', true)
        .order('created_at', { ascending: true });

      setComments(data || []);
      setLoading(false);
    }

    loadComments();
  }, [postId]);

  const handleSubmit = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!newComment.trim()) return;

    setSubmitting(true);
    const { data, error } = await supabase
      .from('blog_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content: newComment.trim(),
        is_approved: true,
      })
      .select(`
        *,
        profiles:user_id (full_name, email)
      `)
      .single();

    if (error) {
      alert('Error posting comment: ' + error.message);
    } else {
      setComments([...comments, data]);
      setNewComment('');
    }
    setSubmitting(false);
  };

  const handleReply = async (parentId) => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!replyContent.trim()) return;

    setSubmitting(true);
    const { data, error } = await supabase
      .from('blog_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content: replyContent.trim(),
        parent_id: parentId,
        is_approved: true,
      })
      .select(`
        *,
        profiles:user_id (full_name, email)
      `)
      .single();

    if (error) {
      alert('Error posting reply: ' + error.message);
    } else {
      setComments([...comments, data]);
      setReplyContent('');
      setReplyTo(null);
    }
    setSubmitting(false);
  };

  const getNestedComments = (parentId = null) => {
    return comments.filter(c => c.parent_id === parentId);
  };

  const renderComment = (comment, depth = 0) => {
    const replies = getNestedComments(comment.id);
    const isReply = replyTo === comment.id;

    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''} mb-4`}>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white font-bold text-xs">
              {(comment.profiles?.full_name || comment.profiles?.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-800">
                {comment.profiles?.full_name || comment.profiles?.email?.split('@')[0] || 'Anonymous'}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(comment.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-700">{comment.content}</p>
          {user && (
            <button
              onClick={() => setReplyTo(isReply ? null : comment.id)}
              className="mt-2 text-xs text-brand-blue hover:underline"
            >
              {isReply ? 'Cancel' : 'Reply'}
            </button>
          )}
        </div>

        {/* Reply form */}
        {isReply && (
          <div className="mt-3 ml-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                onClick={() => handleReply(comment.id)}
                disabled={submitting || !replyContent.trim()}
                className="bg-brand-blue text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                Reply
              </button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {replies.map(reply => renderComment(reply, depth + 1))}
      </div>
    );
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading comments...</div>;

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <h3 className="text-2xl font-bold text-gray-800 mb-6">
        💬 Comments ({comments.filter(c => !c.parent_id).length})
      </h3>

      {/* Comment form */}
      {user ? (
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="bg-brand-yellow text-brand-dark px-6 py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
          >
            Post
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-6">
          Please <a href="/login" className="text-brand-blue font-semibold hover:underline">login</a> to comment.
        </p>
      )}

      {/* Comments list */}
      <div className="space-y-2">
        {getNestedComments().map(comment => renderComment(comment))}
        {comments.filter(c => !c.parent_id).length === 0 && (
          <p className="text-gray-400 text-sm py-4">No comments yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}