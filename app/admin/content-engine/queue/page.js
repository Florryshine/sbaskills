'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Clock, Play, Trash2, RefreshCw, 
  Search, Filter, Zap, CheckCircle, AlertCircle 
} from 'lucide-react';

export default function QueuePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(null);
  const [batchGenerating, setBatchGenerating] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, [filter]);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(`/api/content-engine/queue?status=${filter}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function generateItem(id) {
    setGenerating(id);
    try {
      const res = await fetch('/api/content-engine/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueItemId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchQueue();
        // Redirect to drafts
        window.location.href = '/admin/content-engine/drafts';
      } else {
        alert('Generation failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGenerating(null);
    }
  }

  async function deleteItem(id) {
    if (!confirm('Delete this item from the queue?')) return;
    try {
      await fetch(`/api/content-engine/queue/${id}`, { method: 'DELETE' });
      await fetchQueue();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  // ----- BATCH GENERATION (first 20 pending) -----
  async function generateBatch() {
    const pendingItems = items.filter(item => item.status === 'pending');
    const batch = pendingItems.slice(0, 20);

    if (batch.length === 0) {
      alert('No pending items to generate.');
      return;
    }

    setBatchGenerating(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of batch) {
      try {
        const res = await fetch('/api/content-engine/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueItemId: item.id }),
        });
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
          const data = await res.json();
          console.error(`Failed for ${item.keyword}:`, data.error);
        }
      } catch (e) {
        failCount++;
        console.error(`Error for ${item.keyword}:`, e.message);
      }
      // Delay 1.5 seconds to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setBatchGenerating(false);
    alert(`Batch complete: ${successCount} succeeded, ${failCount} failed.`);
    fetchQueue(); // refresh list
  }

  const getStatusBadge = (status) => {
    const map = {
      pending: { cls: 'bg-blue-50 text-blue-600', label: 'Pending' },
      generating: { cls: 'bg-purple-50 text-purple-600', label: 'Generating' },
      draft: { cls: 'bg-yellow-50 text-yellow-600', label: 'Draft Ready' },
      completed: { cls: 'bg-teal-50 text-teal-600', label: 'Researched' },
      published: { cls: 'bg-green-50 text-green-600', label: 'Published' },
      failed: { cls: 'bg-red-50 text-red-600', label: 'Failed' },
    };
    return map[status] || map.pending;
  };

  const filtered = items.filter(item =>
    item.keyword.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin/content-engine" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Generation Queue</h1>
              <p className="text-sm text-gray-500">{items.length} items in queue</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={generateBatch}
                disabled={batchGenerating}
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {batchGenerating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {batchGenerating ? 'Generating...' : 'Generate Batch (20)'}
              </button>
              <button
                onClick={fetchQueue}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search keywords..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1a73e8] text-sm"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'pending', 'draft', 'published', 'failed'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      filter === s
                        ? 'bg-[#1a73e8] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-700 font-medium">No items in queue</p>
              <p className="text-gray-400 text-sm">Upload keywords to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((item) => {
                const status = getStatusBadge(item.status);
                const canGenerate = item.status === 'pending' || item.status === 'failed';
                return (
                  <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{item.keyword}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400 capitalize">{item.category || 'Uncategorized'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canGenerate && (
                        <button
                          onClick={() => generateItem(item.id)}
                          disabled={generating === item.id}
                          className="inline-flex items-center gap-1 bg-[#FFCC00] text-gray-900 px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#e5b800] transition-colors disabled:opacity-50"
                        >
                          {generating === item.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                          Generate
                        </button>
                      )}
                      {item.status === 'draft' && (
                        <Link
                          href={`/admin/content-engine/drafts?draft=${item.draft_id}`}
                          className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-200 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" /> Review
                        </Link>
                      )}
                      {item.status === 'completed' && item.knowledge_asset_id && (
                        <Link
                          href={`/admin/generate?asset=${item.knowledge_asset_id}`}
                          className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-200 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" /> Generate Content
                        </Link>
                      )}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}