import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Please sign in before uploading a profile photo.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Choose a photo to upload.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, and WebP photos are allowed.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'The photo must be 5 MB or smaller.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageSignature(buffer, file.type)) {
      return NextResponse.json({ error: 'The uploaded file does not appear to be a valid image.' }, { status: 400 });
    }

    const result = await uploadToCloudinary(buffer, {
      resource_type: 'image',
      folder: 'shiney-brain-academy/student-headshots',
      public_id: `student_${user.id}_${Date.now()}`,
      overwrite: false,
      transformation: [{ width: 600, height: 600, crop: 'fill', gravity: 'face' }],
      allowed_formats: ['jpg', 'png', 'webp'],
    });

    return NextResponse.json({ secure_url: result.secure_url, public_id: result.public_id });
  } catch (error) {
    console.error('Student profile photo upload failed:', error);
    return NextResponse.json({ error: 'Photo upload failed. Please try again.' }, { status: 500 });
  }
}