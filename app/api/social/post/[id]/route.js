import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function DELETE(req, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    if (!id) return NextResponse.json({ error: 'Missing post ID' }, { status: 400 });

    const { data: post, error } = await supabase
      .from('social_post_drafts')
      .select('id, status')
      .eq('id', id)
      .single();
    if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    // Optionally delete from external platform if we have postiz_id
    // If you want to delete from the platform, you'd need to implement that.

    await supabase
      .from('social_post_drafts')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({ success: true, message: 'Post cancelled' });
  } catch (err) {
    console.error('Delete error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}