'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function NotificationBell() {
  const supabase = createBrowserClient();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadUnread() {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;

      if (!auth?.user) {
        setUnread(0);
        return;
      }

      const { count, error } = await supabase
        .from('student_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id)
        .is('read_at', null);

      if (active) setUnread(error ? 0 : (count || 0));
    }

    loadUnread();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadUnread();
    });

    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications: ${unread} unread` : 'Notifications'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-blue-50 hover:text-brand-blue"
    >
      <span aria-hidden="true" className="text-lg leading-none">🔔</span>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-1 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[10px] font-black leading-[18px] text-white shadow-sm">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
