import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const resourceType = formData.get('resourceType') || 'video';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await uploadToCloudinary(buffer, {
      resource_type: resourceType === 'image' ? 'image' : 'video',
      folder: resourceType === 'image' ? 'shiney-brain-academy/thumbnails' : 'shiney-brain-academy/lessons'
    });

    return NextResponse.json({
      secure_url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Upload failed.' }, { status: 500 });
  }
}
