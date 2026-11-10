import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  const authClient = createServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: profileError } = await authClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const componentId = params?.componentId;
    if (!componentId) return NextResponse.json({ error: 'Component ID is required.' }, { status: 400 });
    const supabase = createAdminClient();
    const { data: component, error } = await supabase.from('ka_components')
      .select('status,storage_path,mime_type').eq('id', componentId)
      .eq('component_type', 'narration_audio').single();
    if (error || !component || component.status !== 'ready' || !component.storage_path) {
      return NextResponse.json({ error: 'Narration audio not found.' }, { status: 404 });
    }
    const { data: signed, error: signError } = await supabase.storage
      .from('ka-component-audio').createSignedUrl(component.storage_path, 120);
    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Could not prepare narration playback.' }, { status: 500 });
    }
    return NextResponse.redirect(signed.signedUrl, 302);
  } catch (error) {
    console.error('KA narration playback failed:', error);
    return NextResponse.json({ error: 'Could not load narration audio.' }, { status: 500 });
  }
}
