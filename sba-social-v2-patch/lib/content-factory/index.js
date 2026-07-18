// lib/content-factory/index.js
//
// PATCHED: generators can now attach a `_media` instruction to a row
// (stripped before the content_assets insert, used afterward to call the
// real carousel-engine / queue a real video_scripts row). Everything else
// about the orchestration (parallel generators, isolated failures,
// regenerateOne's version/archive behavior) is unchanged.

import { createAdminClient } from '@/lib/supabase-admin';
import { generateInstagram } from './generators/instagram';
import { generateFacebook } from './generators/facebook';
import { generateTelegram } from './generators/telegram';
import { generateLinkedIn } from './generators/linkedin';
import { generateX } from './generators/x';
import { generatePinterest } from './generators/pinterest';
import { generateYouTube } from './generators/youtube';
import { generateTikTok } from './generators/tiktok';
import { attachCarouselMedia, queueVideoScript } from './media-attach';

// Registry — adding a new platform later means writing one generator file
// and adding one line here. Nothing else in the pipeline needs to change.
const GENERATORS = {
  instagram: generateInstagram,
  facebook: generateFacebook,
  telegram: generateTelegram,
  linkedin: generateLinkedIn,
  x: generateX,
  pinterest: generatePinterest,
  youtube: generateYouTube,
  tiktok: generateTikTok,
};

/**
 * Strips the `_media` instruction off a generator row before insert (it's
 * not a content_assets column) and returns both pieces separately so the
 * caller can re-attach media after the row has a real id.
 */
function splitMedia(row) {
  const { _media, ...contentFields } = row;
  return { contentFields, media: _media || null };
}

/**
 * After a content_assets row is inserted, attach whatever real media it
 * needs (if any). Never throws past this point — a failed carousel render
 * or video queue shouldn't roll back the draft itself; it just means that
 * one row's media didn't attach and shows up empty in the review dashboard,
 * same as any other partial failure in this pipeline.
 */
async function attachMediaIfNeeded(insertedRow, media) {
  if (!media) return { ok: true };
  try {
    if (media.type === 'carousel') {
      await attachCarouselMedia(insertedRow.id, {
        title: insertedRow.title,
        summary: media.summary,
        slides: media.slides,
      });
    } else if (media.type === 'video_script') {
      await queueVideoScript(insertedRow.id, {
        title: insertedRow.title,
        format: media.format,
        segments: media.segments,
      });
    }
    return { ok: true };
  } catch (err) {
    console.error(`Media attach failed for content_asset ${insertedRow.id}:`, err);
    return { ok: false, error: err.message };
  }
}

/**
 * Generate every platform's content for a knowledge asset and save as drafts.
 * Platforms that fail don't block the others — each is isolated and reported.
 *
 * @param {string} knowledgeAssetId
 * @param {string[]} [platforms] - subset of GENERATORS keys; defaults to all
 */
export async function runContentFactory(knowledgeAssetId, platforms = Object.keys(GENERATORS)) {
  const supabase = createAdminClient();

  const { data: asset, error: assetError } = await supabase
    .from('knowledge_assets')
    .select('*')
    .eq('id', knowledgeAssetId)
    .single();

  if (assetError || !asset) {
    throw new Error(`Knowledge asset not found: ${knowledgeAssetId}`);
  }

  const results = { succeeded: [], failed: [] };

  // Run generators in parallel — they're independent LLM calls, no reason
  // to serialize them and make the admin wait 8x as long.
  await Promise.all(
    platforms.map(async (platform) => {
      const generator = GENERATORS[platform];
      if (!generator) {
        results.failed.push({ platform, error: 'No generator registered' });
        return;
      }
      try {
        const rows = await generator(asset); // array of content_assets-shaped objects (+ optional _media)
        const split = rows.map(splitMedia);

        const toInsert = split.map(({ contentFields }) => ({
          knowledge_asset_id: knowledgeAssetId,
          status: 'draft',
          generated_by: contentFields.generated_by || 'content-factory-v2',
          ...contentFields,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('content_assets')
          .insert(toInsert)
          .select();

        if (insertError) throw insertError;

        // Insert preserves array order for a single insert call, so we can
        // zip the inserted rows back up with their original media instructions.
        const mediaResults = await Promise.all(
          inserted.map((row, i) => attachMediaIfNeeded(row, split[i].media))
        );

        results.succeeded.push({
          platform,
          count: inserted.length,
          ids: inserted.map((r) => r.id),
          mediaErrors: mediaResults
            .map((r, i) => (r.ok ? null : { id: inserted[i].id, error: r.error }))
            .filter(Boolean),
        });
      } catch (err) {
        console.error(`Content factory failed for ${platform}:`, err);
        results.failed.push({ platform, error: err.message });
      }
    })
  );

  return results;
}

/**
 * Regenerate ONE existing content_assets row without touching any others.
 * Bumps the version and links back to the row it replaced, so history is
 * preserved (the old row's status is set to 'archived' rather than deleted).
 * If the regenerated row needs media (carousel/video), that's re-attached
 * too — old media rows stay put, pointing at the now-archived row, since
 * media_files.content_asset_id cascades on delete, not on archive.
 */
export async function regenerateOne(contentAssetId) {
  const supabase = createAdminClient();

  const { data: existing, error } = await supabase
    .from('content_assets')
    .select('*, knowledge_assets(*)')
    .eq('id', contentAssetId)
    .single();

  if (error || !existing) throw new Error('Content asset not found');

  const generator = GENERATORS[existing.platform];
  if (!generator) throw new Error(`No generator for platform: ${existing.platform}`);

  const asset = existing.knowledge_assets;
  const rows = await generator(asset);

  // A platform generator can return multiple rows (e.g. instagram returns
  // carousel + caption) — only replace the one matching this asset_type.
  const match = rows.find((r) => r.asset_type === existing.asset_type) || rows[0];
  const { contentFields, media } = splitMedia(match);

  const { data: inserted, error: insertError } = await supabase
    .from('content_assets')
    .insert({
      knowledge_asset_id: existing.knowledge_asset_id,
      status: 'draft',
      version: (existing.version || 1) + 1,
      regenerated_from: existing.id,
      generated_by: 'content-factory-v2-regenerate',
      ...contentFields,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  await attachMediaIfNeeded(inserted, media);

  await supabase.from('content_assets').update({ status: 'archived' }).eq('id', existing.id);

  return inserted;
}

export { GENERATORS as CONTENT_FACTORY_PLATFORMS };
