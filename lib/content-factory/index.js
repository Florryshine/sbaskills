import { createAdminClient } from '@/lib/supabase-admin';
import { getOrGenerateComponentForAsset, recordComponentUse } from '@/lib/ka-package';
import { generateInstagram } from './generators/instagram';
import { generateFacebook } from './generators/facebook';
import { generateTelegram } from './generators/telegram';
import { generateLinkedIn } from './generators/linkedin';
import { generateX } from './generators/x';
import { generatePinterest } from './generators/pinterest';
import { generateYouTube } from './generators/youtube';
import { generateTikTok } from './generators/tiktok';
import { generateFounderPost } from './generators/founder';
import { attachCarouselMedia, queueVideoScript, attachHeroImage } from './media-attach';

const GENERATORS = {
  instagram: generateInstagram, facebook: generateFacebook, telegram: generateTelegram,
  linkedin: generateLinkedIn, x: generateX, pinterest: generatePinterest,
  youtube: generateYouTube, tiktok: generateTikTok, founder: generateFounderPost,
};
const DEFAULT_PLATFORMS = Object.keys(GENERATORS).filter((p) => p !== 'founder');
const CAROUSEL_PLATFORMS = new Set(['instagram','facebook','telegram','linkedin']);
const SHORT_VIDEO_PLATFORMS = new Set(['youtube','tiktok']);

function splitMedia(row) {
  const { _media, ...contentFields } = row;
  return { contentFields, media: _media || null };
}

async function attachMediaIfNeeded(insertedRow, media) {
  if (!media) return { ok: true };
  try {
    if (media.type === 'carousel') {
      await attachCarouselMedia(insertedRow.id, {
        title: insertedRow.title, summary: media.summary, slides: media.slides, platform: media.platform,
      });
    } else if (media.type === 'video_script') {
      await queueVideoScript(insertedRow.id, { title: insertedRow.title, format: media.format, segments: media.segments });
    } else if (media.type === 'hero_image') {
      await attachHeroImage(insertedRow.id, {
        title: insertedRow.title, category: media.category, searchQuery: media.searchQuery, preset: media.preset,
      });
    }
    return { ok: true };
  } catch (err) {
    console.error('Media attach failed for content_asset ' + insertedRow.id + ':', err);
    return { ok: false, error: err.message };
  }
}

export async function runContentFactory(knowledgeAssetId, platforms = DEFAULT_PLATFORMS, options = {}) {
  const supabase = createAdminClient();
  const { data: asset, error: assetError } = await supabase
    .from('knowledge_assets').select('*').eq('id', knowledgeAssetId).single();
  if (assetError || !asset) throw new Error('Knowledge asset not found: ' + knowledgeAssetId);

  const shared = {};
  const selected = new Set(platforms || DEFAULT_PLATFORMS);

  // Build each common component ONCE before the parallel platform adapters run.
  // If the library is unavailable or another request owns its lock, preserve the
  // old platform-specific generator path rather than blocking social publishing.
  if ([...selected].some((p) => CAROUSEL_PLATFORMS.has(p))) {
    try {
      const result = await getOrGenerateComponentForAsset(asset, 'carousel_slides');
      shared.carouselSlides = result.component.body.slides;
      shared.carouselComponent = result.component;
    } catch (error) {
      console.warn('Shared carousel component unavailable; platform fallback will run:', error.message);
    }
  }

  if ([...selected].some((p) => SHORT_VIDEO_PLATFORMS.has(p))) {
    try {
      const result = await getOrGenerateComponentForAsset(asset, 'short_script');
      shared.shortScript = result.component.body;
      shared.shortScriptComponent = result.component;
    } catch (error) {
      console.warn('Shared short-script component unavailable; platform fallback will run:', error.message);
    }
  }

  const results = { succeeded: [], failed: [] };
  await Promise.all((platforms || DEFAULT_PLATFORMS).map(async (platform) => {
    const generator = GENERATORS[platform];
    if (!generator) {
      results.failed.push({ platform, error: 'No generator registered' });
      return;
    }
    try {
      const platformOptions = {
        ...(options[platform] || {}),
        ...(CAROUSEL_PLATFORMS.has(platform) && shared.carouselSlides
          ? { sharedSlides: shared.carouselSlides, sharedComponentId: shared.carouselComponent.id } : {}),
        ...(SHORT_VIDEO_PLATFORMS.has(platform) && shared.shortScript
          ? { sharedShortScript: shared.shortScript, sharedComponentId: shared.shortScriptComponent.id } : {}),
      };
      const rows = await generator(asset, platformOptions);
      const split = rows.map(splitMedia);
      const componentRefs = [];
      if (CAROUSEL_PLATFORMS.has(platform) && shared.carouselComponent) componentRefs.push(shared.carouselComponent.id);
      if (SHORT_VIDEO_PLATFORMS.has(platform) && shared.shortScriptComponent) componentRefs.push(shared.shortScriptComponent.id);

      const toInsert = split.map(({ contentFields }) => ({
        knowledge_asset_id: knowledgeAssetId,
        status: 'draft',
        generated_by: contentFields.generated_by || 'content-factory-v2',
        ...contentFields,
        metadata: {
          ...(contentFields.metadata || {}),
          ...(componentRefs.length ? { component_refs: componentRefs } : {}),
        },
      }));

      const { data: inserted, error: insertError } = await supabase.from('content_assets').insert(toInsert).select();
      if (insertError) throw insertError;

      const mediaResults = await Promise.all(inserted.map((row, i) => attachMediaIfNeeded(row, split[i].media)));
      await Promise.all(componentRefs.flatMap((componentId) =>
        inserted.map((row) => recordComponentUse(componentId, 'content_asset', row.id))
      ));

      results.succeeded.push({
        platform, count: inserted.length, ids: inserted.map((row) => row.id),
        reusedComponents: componentRefs,
        mediaErrors: mediaResults.map((r, i) => r.ok ? null : { id: inserted[i].id, error: r.error }).filter(Boolean),
      });
    } catch (err) {
      console.error('Content factory failed for ' + platform + ':', err);
      results.failed.push({ platform, error: err.message });
    }
  }));
  return results;
}

export async function regenerateOne(contentAssetId) {
  const supabase = createAdminClient();
  const { data: existing, error } = await supabase.from('content_assets')
    .select('*, knowledge_assets(*)').eq('id', contentAssetId).single();
  if (error || !existing) throw new Error('Content asset not found');

  const generatorKey = existing.asset_type?.startsWith('founder_') ? 'founder' : existing.platform;
  const generator = GENERATORS[generatorKey];
  if (!generator) throw new Error('No generator for: ' + generatorKey);

  const regenOptions = existing.metadata?.voiceMode
    ? { voiceMode: existing.metadata.voiceMode, founderContext: existing.metadata.founderContext } : {};
  const rows = await generator(existing.knowledge_assets, regenOptions);
  const match = rows.find((row) => row.asset_type === existing.asset_type) || rows[0];
  const { contentFields, media } = splitMedia(match);

  const { data: inserted, error: insertError } = await supabase.from('content_assets').insert({
    knowledge_asset_id: existing.knowledge_asset_id,
    status: 'draft',
    version: (existing.version || 1) + 1,
    regenerated_from: existing.id,
    generated_by: 'content-factory-v2-regenerate',
    ...contentFields,
  }).select().single();
  if (insertError) throw insertError;

  await attachMediaIfNeeded(inserted, media);
  await supabase.from('content_assets').update({ status: 'archived' }).eq('id', existing.id);
  return inserted;
}

export { GENERATORS as CONTENT_FACTORY_PLATFORMS };
