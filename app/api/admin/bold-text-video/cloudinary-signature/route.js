import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in before saving videos.' }, { status: 401 });
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return NextResponse.json({ error: 'Cloudinary is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to Vercel environment variables.' }, { status: 503 });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'shiney-brain-academy/bold-text-videos';
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, apiSecret);
  return NextResponse.json({ cloudName, apiKey, timestamp, folder, signature });
}
