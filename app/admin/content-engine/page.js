'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Zap, Upload, FileText, Clock, CheckCircle, 
  ArrowRight, Layers, Plus, Image as ImageIcon 
} from 'lucide-react';

export default function ContentEnginePage() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const [statsRes, queueRes] = await Promise.all([
        fetch('/api/content-engine/stats'),
        fetch('/api/content-engine/queue?limit=5')
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (queueRes.ok) setQueue((await queueRes.json()).items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'In Queue', value: stats?.queued ?? '—', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Drafts Ready', value: stats?.drafts ?? '—', icon: FileText, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { label: 'Published', value: stats?.published ?? '—', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Total Assets', value: stats?.total ?? '—', icon: Layers, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#1a73e8] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Engine</h1>
            <p className="text-sm text-gray-500">Shiney Brain Academy · Knowledge Asset System</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{loading ? '—' : s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Link href="/admin/content-engine/upload" 
          className="bg-[#1a73e8] text-white rounded-2xl p-6 hover:bg-[#1557b0] transition-colors group">
          <Upload className="w-8 h-8 mb-3 opacity-90" />
          <h3 className="font-bold text-lg mb-1">Upload Keywords</h3>
          <p className="text-blue-100 text-sm">Import a CSV to build your generation queue</p>
          <div className="flex items-center gap-1 mt-4 text-sm font-medium">
            Start here <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link href="/admin/content-engine/queue"
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:border-[#1a73e8] transition-colors group">
          <Clock className="w-8 h-8 mb-3 text-[#1a73e8]" />
          <h3 className="font-bold text-lg text-gray-900 mb-1">Generation Queue</h3>
          <p className="text-gray-500 text-sm">View, reorder, and generate from your keyword queue</p>
          <div className="flex items-center gap-1 mt-4 text-sm font-medium text-[#1a73e8]">
            View Queue <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link href="/admin/content-engine/drafts"
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:border-[#FFCC00] transition-colors group">
          <FileText className="w-8 h-8 mb-3 text-[#FFCC00]" />
          <h3 className="font-bold text-lg text-gray-900 mb-1">Review Drafts</h3>
          <p className="text-gray-500 text-sm">Review, edit, score, and publish generated articles</p>
          <div className="flex items-center gap-1 mt-4 text-sm font-medium text-[#FFCC00]">
            Review Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* NEW: Image Engine Card */}
        <Link href="/admin/asset-images"
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:border-[#1a73e8] transition-colors group">
          <ImageIcon className="w-8 h-8 mb-3 text-[#1a73e8]" />
          <h3 className="font-bold text-lg text-gray-900 mb-1">Image Engine</h3>
          <p className="text-gray-500 text-sm">Generate, edit, and manage images for your assets</p>
          <div className="flex items-center gap-1 mt-4 text-sm font-medium text-[#1a73e8]">
            Open Image Engine <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Next Up in Queue</h2>
          <Link href="/admin/content-engine/queue" 
            className="text-sm text-[#1a73e8] font-medium hover:underline">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-[#1a73e8]" />
            </div>
            <p className="text-gray-700 font-medium mb-1">No keywords in queue yet</p>
            <p className="text-gray-400 text-sm mb-4">Upload a CSV file to get started</p>
            <Link href="/admin/content-engine/upload"
              className="inline-flex items-center gap-2 bg-[#1a73e8] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1557b0] transition-colors">
              <Plus className="w-4 h-4" /> Upload Keywords
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {queue.map((item, i) => (
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{item.keyword}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{item.category}</div>
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