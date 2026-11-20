import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import DOMPurify from 'isomorphic-dompurify';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024;
const MIME_TYPES = new Set(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
function slugify(value) {
  return String(value || 'visual-asset').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'visual-asset';
}
function sanitizeSvg(source) {
  const raw = String(source || '');
  if (!/<svg[\\s>]/i.test(raw)) throw new Error('The uploaded file is not a valid SVG document.');
  if (/<!ENTITY|<!DOCTYPE/i.test(raw)) throw new Error('SVG document types and entities are not allowed.');
  let svg = DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  });
  // Shared-library SVGs must not load remote resources.
  svg = svg
    .replace(/\\s+(?:xlink:)?href\\s*=\\s*("|')(?!#)[\\s\\S]*?\\1/gi, '')
    .replace(/url\\(\\s*['"]?(?!#)[^)]+\\)/gi, 'none');
  if (!/<svg[\\s>]/i.test(svg)) throw new Error('SVG did not pass sanitization.');
  return svg;
}

export async function GET(request) {
  const { response } = await requireAdminApi();
  if (response) return response;
  try {
    const supabase = createAdminClient();
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 80);
    const subject = url.searchParams.get('subject');
    const category = url.searchParams.get('category');
    let query = supabase.from('visual_assets').select('*').eq('is_active', true)
      .order('usage_count', { ascending: false }).order('created_at', { ascending: false }).limit(100);
    if (subject) query = query.eq('subject', subject);
    if (category) query = query.eq('category', category);
    if (q) {
      const safe = q.replace(/[^a-z0-9 _-]/gi, ' ').trim();
      if (safe) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return NextResponse.json({ assets: data || [] });
  } catch (error) {
    return fail(error.message || 'Could not search the visual asset library.', 500);
  }
}

export async function POST(request) {
  const { user, response } = await requireAdminApi();
  if (response) return response;
  try {
    const form = await request.formData();
    const file = form.get('file');
    const name = String(form.get('name') || file?.name || '').trim().slice(0, 160);
    if (!file || typeof file.arrayBuffer !== 'function') return fail('Choose an image or SVG file.');
    if (!name) return fail('Asset name is required.');
    if (file.size <= 0 || file.size > MAX_BYTES) return fail('Asset file must be between 1 byte and 12 MB.');
    const mime = String(file.type || 'application/octet-stream').toLowerCase();
    if (!MIME_TYPES.has(mime)) return fail('Supported formats: SVG, PNG, JPG, WEBP and GIF.');

    let buffer = Buffer.from(await file.arrayBuffer());
    if (mime === 'image/svg+xml') {
      try { buffer = Buffer.from(sanitizeSvg(buffer.toString('utf8')), 'utf8'); }
      catch (error) { return fail(error.message); }
    }
    const hash = createHash('sha256').update(buffer).digest('hex');
    const supabase = createAdminClient();
    const { data: duplicate, error: duplicateError } = await supabase.from('visual_assets')
      .select('id,name,public_url').eq('content_hash', hash).maybeSingle();
    if (duplicateError) return fail(duplicateError.message, 500);
    if (duplicate) return NextResponse.json({ asset: duplicate, reused: true });

    const extension = mime === 'image/svg+xml' ? 'svg' : mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
    const slug = `${slugify(name)}-${hash.slice(0, 8)}`;
    const storagePath = `library/${slug}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('visual-assets')
      .upload(storagePath, buffer, { contentType: mime, upsert: false });
    if (uploadError) return fail('Visual asset upload failed: ' + uploadError.message, 500);
    const { data: publicData } = supabase.storage.from('visual-assets').getPublicUrl(storagePath);
    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) {
      await supabase.storage.from('visual-assets').remove([storagePath]);
      return fail('Could not resolve the uploaded asset URL.', 500);
    }

    const keywords = String(form.get('keywords') || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 30);
    const payload = {
      name, slug, description: String(form.get('description') || '').slice(0, 1000),
      subject: String(form.get('subject') || 'General').slice(0, 80),
      category: String(form.get('category') || 'object').slice(0, 60),
      asset_type: mime === 'image/svg+xml' ? 'svg' : mime === 'image/gif' ? 'gif' : 'image',
      keywords, storage_path: storagePath, public_url: publicUrl, mime_type: mime,
      file_size_bytes: buffer.length, source: 'upload',
      source_url: String(form.get('sourceUrl') || '').slice(0, 1000) || null,
      creator: String(form.get('creator') || '').slice(0, 180) || null,
      license: String(form.get('license') || 'Unspecified — verify before external use').slice(0, 180),
      license_url: String(form.get('licenseUrl') || '').slice(0, 1000) || null,
      attribution_required: form.get('attributionRequired') === 'true',
      attribution: String(form.get('attribution') || '').slice(0, 500) || null,
      content_hash: hash, generation_params: { uploaded_by: user.id, original_name: file.name },
    };
    const { data: asset, error: insertError } = await supabase.from('visual_assets').insert(payload).select('*').single();
    if (insertError) {
      await supabase.storage.from('visual-assets').remove([storagePath]);
      return fail('Could not register visual asset: ' + insertError.message, 500);
    }
    return NextResponse.json({ asset, reused: false }, { status: 201 });
  } catch (error) {
    console.error('[visual-assets] upload failed:', error);
    return fail(error.message || 'Could not upload visual asset.', 500);
  }
}
