'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ posts: 0, users: 0, audio: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      const { count: posts } = await supabase.from('blog_posts').select('*', { count: 'exact', head: true })
      const { count: users } = await supabase.from('user_points').select('*', { count: 'exact', head: true })
      const { count: audio } = await supabase.from('audio_library').select('*', { count: 'exact', head: true })
      setStats({ posts: posts || 0, users: users || 0, audio: audio || 0 })
    }
    fetchStats()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-lg font-semibold">📝 Blog Posts</h2>
          <p className="text-3xl font-bold">{stats.posts}</p>
          <Link href="/admin/blog" className="text-blue-600 text-sm">Manage →</Link>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-lg font-semibold">👥 Active Students</h2>
          <p className="text-3xl font-bold">{stats.users}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-lg font-semibold">🎧 Audio Files</h2>
          <p className="text-3xl font-bold">{stats.audio}</p>
          <Link href="/admin/audio" className="text-blue-600 text-sm">Manage →</Link>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow border">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <Link href="/admin/blog/new" className="bg-blue-600 text-white px-4 py-2 rounded">➕ New Blog Post</Link>
          <Link href="/admin/challenges/new" className="bg-green-600 text-white px-4 py-2 rounded">🏆 New Challenge</Link>
        </div>
      </div>
    </div>
  )
}