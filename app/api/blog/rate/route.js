import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

// ─── Shared aggregate helper ────────────────────────────────────────────
async function getAggregate(supabase, postId) {
  const { data, error } = await supabase
    .from('blog_post_ratings')
    .select('rating')
    .eq('post_id', postId);

  if (error) throw error;

  const count = data.length;
  const average = count > 0 ? data.reduce((sum, r) => sum + r.rating, 0) / count : 0;

  return {
    count,
    average: Math.round(average * 10) / 10, // one decimal place, e.g. 4.7
  };
}

// GET /api/blog/rate?postId=... → { count, average }
export async function GET(request) {
  try {
    const postId = new URL(request.url).searchParams.get('postId');
    if (!postId) {
      return NextResponse.json({ success: false, message: 'postId is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient();
    const aggregate = await getAggregate(supabase, postId);

    return NextResponse.json({ success: true, ...aggregate });
  } catch (error) {
    console.error('Rating fetch error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/blog/rate  { postId, rating } → { count, average }
// Anonymous submissions are allowed (rating widgets get almost no votes if
// login is required) — repeat-vote protection for anonymous users lives in
// the client widget (localStorage), while logged-in users are deduped at
// the database level via the unique index on (post_id, user_id).
export async function POST(request) {
  try {
    const { postId, rating } = await request.json();

    if (!postId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: 'A valid postId and a rating from 1-5 are required' },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from('blog_post_ratings').insert({
      post_id: postId,
      user_id: user?.id || null,
      rating,
    });

    // A logged-in user re-rating the same post hits the unique index —
    // treat that as "already rated" rather than a hard error.
    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }

    const aggregate = await getAggregate(supabase, postId);
    return NextResponse.json({ success: true, ...aggregate });
  } catch (error) {
    console.error('Rating submit error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
