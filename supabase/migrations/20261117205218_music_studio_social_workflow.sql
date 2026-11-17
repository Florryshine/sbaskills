-- Persistent Musical Learning Studio drafts and publishable media.
-- Lyrics remain on content_assets; audio/video are separate media_files rows.
ALTER TABLE public.content_assets
  ALTER COLUMN knowledge_asset_id DROP NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'music-studio-media',
  'music-studio-media',
  true,
  209715200,
  ARRAY[
    'video/mp4',
    'video/webm',
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/webm',
    'audio/ogg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
