'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, FileText, Eye, CheckCircle, AlertCircle,
  Calendar, User, Zap, BarChart2, BookOpen, Star,
  XCircle, ExternalLink, RefreshCw
} from 'lucide-react';

export default function DraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(null);

  useEffect(() => {
    fetchDrafts();
  }, []);

  async function fetchDrafts() {
    setLoading(true);
    try {
      const res = await fetch('/api/content-engine/drafts');
      const data = await res.json();
      setDrafts(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function publishDraft(id) {
    if (!confirm('Publish this draft?')) return;
    setPublishing(id);
    try {
      const res = await fetch('/api/content-engine/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: id }),
      });
      if (res.ok) {
        await fetchDrafts();
      } else {
        const data = await res.json();
        alert('Publish failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setPublishing(null);
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/content-engine" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Review Drafts</h1>
          <span className="text-sm text-gray-500">{drafts.length} drafts ready</span>
          <button
            onClick={fetchDrafts}
            className="ml-auto inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-700 font-medium">No drafts ready for review</p>
            <p className="text-gray-400 text-sm">Generate content from the queue to create drafts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <div key={draft.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-gray-900 truncate">
                        {draft.title || draft.keyword || 'Untitled'}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getScoreBg(draft.content_score || 0)}`}>
                        Score: {draft.content_score || 0}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{draft.meta_description}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-400">
                      <span>{draft.word_count || 0} words</span>
                      <span>Readability: {draft.readability_score || 0}%</span>
                      <span>{draft.internal_links || 0} internal links</span>
                      <span>{draft.images || 0} images</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {draft.tags?.map((tag, i) => (
                        <span key={i} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => publishDraft(draft.id)}
                      disabled={publishing === draft.id}
                      className="inline-flex items-center gap-2 bg-[#FFCC00] text-gray-900 px-5 py-2.5 rounded-xl font-medium hover:bg-[#e5b800] transition-colors disabled:opacity-50"
                    >
                      {publishing === draft.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Publish
                    </button>
                    <Link
                      href={`/blog/${draft.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-sm text-[#1a73e8] hover:underline"
                    >
                      Preview <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Created: {new Date(draft.created_at).toLocaleDateString()}</span>
                    <span className="capitalize">{draft.category || 'Uncategorized'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/content-engine/drafts/${draft.id}`}
                      className="text-[#1a73e8] text-sm font-medium hover:underline"
                    >
                      Full Preview & Edit →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}