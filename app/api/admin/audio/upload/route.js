import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    // createRouteHandlerClient uses the anon key + user cookies, so it's
    // subject to RLS. Storage/table writes here need to bypass RLS, so we
    // use the real service-role client for the writes, and the cookie
    // client only to identify who's uploading (for created_by).
    const authClient = createRouteHandlerClient();
    const supabase = createAdminClient();

    const formData = await request.formData();
    const title = formData.get('title');
    const description = formData.get('description');
    const audioFile = formData.get('audioFile');
    const coverImage = formData.get('coverImage');

    if (!title || !audioFile) {
      return NextResponse.json(
        { error: 'Title and audio file are required' },
        { status: 400 }
      );
    }

    // ── Upload audio file to storage ──
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const audioExt = audioFile.name.split('.').pop();
    const audioFileName = `audio-${Date.now()}.${audioExt}`;
    const audioPath = `audio-files/${audioFileName}`;

    const { error: audioUploadError } = await supabase.storage
      .from('audio-files') // bucket name from your screenshot
      .upload(audioPath, audioBuffer, {
        contentType: audioFile.type,
        cacheControl: '3600',
      });

    if (audioUploadError) {
      console.error('Audio upload error:', audioUploadError);
      return NextResponse.json(
        { error: 'Failed to upload audio file: ' + audioUploadError.message },
        { status: 500 }
      );
    }

    const { data: audioUrlData } = supabase.storage
      .from('audio-files')
      .getPublicUrl(audioPath);

    const audioUrl = audioUrlData.publicUrl;

    // ── Upload cover image (if provided) ──
    let coverImageUrl = null;
    if (coverImage && coverImage.size > 0) {
      const imgBuffer = Buffer.from(await coverImage.arrayBuffer());
      const imgExt = coverImage.name.split('.').pop();
      const imgFileName = `cover-${Date.now()}.${imgExt}`;
      const imgPath = `audio-images/${imgFileName}`;

      const { error: imgUploadError } = await supabase.storage
        .from('audio-images')
        .upload(imgPath, imgBuffer, {
          contentType: coverImage.type,
          cacheControl: '3600',
        });

      if (!imgUploadError) {
        const { data: imgUrlData } = supabase.storage
          .from('audio-images')
          .getPublicUrl(imgPath);
        coverImageUrl = imgUrlData.publicUrl;
      } else {
        console.warn('Cover image upload failed:', imgUploadError);
      }
    }

    // ── Insert into database ──
    const { data, error } = await supabase
      .from('audio')
      .insert({
        title,
        description: description || null,
        audio_url: audioUrl,
        cover_image: coverImageUrl,
        created_by: (await authClient.auth.getUser()).data.user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json(
        { error: 'Failed to save audio record: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      audioUrl,
      coverImageUrl,
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}