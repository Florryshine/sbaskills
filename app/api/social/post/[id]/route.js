import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Platform character limits, mirrored in PostPreviewer.tsx for the live counter.
const PLATFORM_LIMITS = {
  X: 280,
  Threads: 500,
  LinkedIn: 3000,
  Facebook: 63206,
  Instagram: 2200,
  Telegram: 4096,
};

export async function PATCH(req, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    if (!id) return NextResponse.json({ error: 'Missing post ID' }, { status: 400 });

    const { caption } = await req.json();
    if (typeof caption !== 'string' || caption.trim().length === 0) {
      return NextResponse.json({ error: 'Caption cannot be empty' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('social_post_drafts')
      .select('id, platform')
      .eq('id', id)
      .single();
    if (fetchError || !existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const limit = PLATFORM_LIMITS[existing.platform];
    if (limit && caption.length > limit) {
      return NextResponse.json(
        { error: `Caption exceeds ${existing.platform}'s ${limit} character limit by ${caption.length - limit}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('social_post_drafts')
      .update({ caption, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, post: data });
  } catch (err) {
    console.error('Update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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