'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createBrowserClient } from '@/lib/supabase';

function timeAgo(value) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

export default function NotificationsPage() {
  const supabase = createBrowserClient();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load(user) {
    const { data, error } = await supabase
      .from('student_notifications')
      .select('id, type, title, body, action_url, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setItems(data || []);
  }

  useEffect(() => {
    async function start() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        window.location.href = '/login';
        return;
      }
      setUserId(auth.user.id);
      await load(auth.user);
      setLoading(false);
    }
    start();
  }, []);

  async function markRead(id) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('student_notifications')
      .update({ read_at: now })
      .eq('id', id)
      .eq('user_id', userId);
    if (!error) setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: now } : item));
  }

  async function markAllRead() {
    if (!userId || busy) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('student_notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null);
    if (!error) setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || now })));
    setBusy(false);
  }

  async function openNotification(item) {
    if (!item.read_at) await markRead(item.id);
    if (item.action_url && item.action_url.startsWith('/')) window.location.href = item.action_url;
  }

  const unread = items.filter((item) => !item.read_at).length;

  if (loading) return <><Navbar /><main className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="font-bold text-brand-blue">Loading notifications...</p></main><Footer /></>;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pb-16">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">STUDENT UPDATES</p>
              <h1 className="mt-1 text-3xl font-black text-brand-blue">Notifications</h1>
              <p className="mt-2 text-sm text-slate-500">{unread ? unread + ' unread update' + (unread === 1 ? '' : 's') : 'You are all caught up.'}</p>
            </div>
            {unread > 0 && <button onClick={markAllRead} disabled={busy} className="rounded-xl border bg-white px-4 py-2 text-sm font-extrabold text-brand-blue disabled:opacity-50">{busy ? 'Marking...' : 'Mark all read'}</button>}
          </div>

          <div className="mt-6 space-y-3">
            {items.length ? items.map((item) => (
              <button key={item.id} onClick={() => openNotification(item)} className={'w-full text-left rounded-3xl border p-5 shadow-sm transition hover:border-brand-blue ' + (item.read_at ? 'bg-white' : 'bg-blue-50 border-blue-200')}>
                <div className="flex gap-4">
                  <div className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-full ' + (item.read_at ? 'bg-slate-100' : 'bg-brand-blue text-white')}>{item.type === 'DAILY_MISSION_READY' ? '🎯' : '🔔'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-black text-slate-900">{item.title}</h2>
                      <span className="shrink-0 text-xs font-bold text-slate-400">{timeAgo(item.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                    {item.action_url && <p className="mt-2 text-xs font-extrabold text-brand-blue">Open →</p>}
                  </div>
                  {!item.read_at && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-yellow" />}
                </div>
              </button>
            )) : (
              <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
                <div className="text-5xl">🔔</div>
                <h2 className="mt-4 text-xl font-black text-slate-900">No notifications yet</h2>
                <p className="mt-2 text-sm text-slate-500">When something important is ready for you, it will appear here.</p>
                <Link href="/dashboard" className="mt-5 inline-block rounded-xl bg-brand-yellow px-5 py-3 font-black text-brand-dark">Back to dashboard</Link>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
