import { createServerClient } from '@/lib/supabase-server';

export async function requireLandingAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { ok: false, status: 403 };
  }
  return { ok: true, user };
}
