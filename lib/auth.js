import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';

export async function getCurrentUserWithProfile() {
  const supabase = createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, supabase };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile, supabase };
}

export async function requireStudent() {
  const result = await getCurrentUserWithProfile();

  if (!result.user) {
    redirect('/login');
  }

  return result;
}

export async function requireAdmin() {
  const result = await getCurrentUserWithProfile();

  if (!result.user) {
    redirect('/admin/login');
  }

  if (!result.profile || result.profile.role !== 'admin') {
    redirect('/dashboard');
  }

  return result;
}
