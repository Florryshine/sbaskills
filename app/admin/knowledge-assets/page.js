'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

export default function KnowledgeAssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, learning, advice, news
  const supabase = createBrowserClient();

  useEffect(() => {
    loadAssets();
  }, [search, filter]);

  const loadAssets = async () => {
    setLoading(true);
    let query = supabase.from('knowledge_assets').select('*').order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('keyword', `%${search}%`);
    }
    if (filter !== 'all') {
      query = query.eq('topic_type', filter);
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
    } else {
      setAssets(data || []);
    }
    setLoading(false);
  };

  const deleteAsset = async (id) => {
    if (!confirm('Delete this knowledge asset and all its generated content?')) return;
    const { error } = await supabase.from('knowledge_assets').delete().eq('id', id);
    if (error) alert(error.message);
    else loadAssets();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-brand-blue">🧠 Knowledge Assets</h1>
        <Link
          href="/admin/generate"
          className="bg-brand-yellow px-4 py-2 rounded-xl font-bold hover:opacity-90"
        >
          + Generate New
        </Link>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search by keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-slate-200 px-4 py-2"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2"
        >
          <option value="all">All Types</option>
          <option value="learning">Learning</option>
          <option value="advice">Advice</option>
          <option value="news">News</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No knowledge assets found.</div>
      ) : (
        <div className="grid gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-white rounded-2xl shadow-sm border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex-1">
                <h3 className="font-bold text-lg">{asset.keyword}</h3>
                <p className="text-sm text-gray-500">
                  Type: {asset.topic_type} • Difficulty: {asset.difficulty}/5 • Concepts: {asset.key_concepts?.length || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{asset.summary}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/admin/generate?assetId=${asset.id}`}
                  className="bg-brand-blue text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90"
                >
                  Generate Content
                </Link>
                <button
                  onClick={() => deleteAsset(asset.id)}
                  className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}