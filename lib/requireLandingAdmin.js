// ADAPT: this almost certainly duplicates an admin-check helper you
// already have (you've got an admin panel with protected routes already).
// Find that helper and use it instead in every /api/admin/landing/* route
// below — this stub exists only so the patch is self-contained.
//
// Expected contract: resolves to { ok: true } if the current request's
// session belongs to an admin, or { ok: false, status } otherwise.
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function requireLandingAdmin() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

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
