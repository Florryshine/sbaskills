// lib/content-factory/index.js
//
// The single entry point: given a knowledge_asset_id, generate every
// platform-specific content_assets row as a DRAFT. Nothing here ever
// publishes anything — that's the publish-jobs pipeline's job, and it
// only runs after a human approves a draft in the review dashboard.

import { createAdminClient } from '@/lib/supabase-admin';
import { generateInstagram } from './generators/instagram';
import { generateFacebook } from './generators/facebook';
import { generateTelegram } from './generators/telegram';
import { generateLinkedIn } from './generators/linkedin';
import { generateX } from './generators/x';
import { generatePinterest } from './generators/pinterest';
import { generateYouTube } from './generators/youtube';
import { generateTikTok } from './generators/tiktok';

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
        const rows = await generator(asset); // array of content_assets-shaped objects
        const toInsert = rows.map((row) => ({
          knowledge_asset_id: knowledgeAssetId,
          status: 'draft',
          generated_by: row.generated_by || 'content-factory-v2',
          ...row,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('content_assets')
          .insert(toInsert)
          .select();

        if (insertError) throw insertError;

        results.succeeded.push({ platform, count: inserted.length, ids: inserted.map((r) => r.id) });
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

  const { data: inserted, error: insertError } = await supabase
    .from('content_assets')
    .insert({
      knowledge_asset_id: existing.knowledge_asset_id,
      status: 'draft',
      version: (existing.version || 1) + 1,
      regenerated_from: existing.id,
      generated_by: 'content-factory-v2-regenerate',
      ...match,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  await supabase.from('content_assets').update({ status: 'archived' }).eq('id', existing.id);

  return inserted;
}

export { GENERATORS as CONTENT_FACTORY_PLATFORMS };
