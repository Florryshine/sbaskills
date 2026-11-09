import { createAdminClient } from '@/lib/supabase-admin';
import { COMPONENT_PROMPT_VERSIONS, getComponentSourceHash, isComponentFresh } from './context';
import { generatePackageComponent } from './generators';

export async function getOrGenerateComponentForAsset(asset, componentType, options = {}) {
  const supabase = createAdminClient();
  const variant = options.variant || '';
  const promptVersion = COMPONENT_PROMPT_VERSIONS[componentType];
  if (!promptVersion) throw new Error('Unsupported component type: ' + componentType);
  const sourceHash = getComponentSourceHash(asset, componentType);
  const { data: rows, error: claimError } = await supabase.rpc('claim_ka_component', {
    p_asset_id: asset.id,
    p_component_type: componentType,
    p_variant: variant,
    p_source_hash: sourceHash,
    p_prompt_version: promptVersion,
    p_created_by: options.createdBy || null,
    p_force: Boolean(options.force),
  });
  if (claimError) throw new Error('Could not claim ' + componentType + ': ' + claimError.message);
  const claim = Array.isArray(rows) ? rows[0] : rows;
  if (!claim || !claim.component_id) throw new Error('No component claim returned for ' + componentType);

  if (!claim.should_generate) {
    if (claim.component_status === 'ready') {
      return { component: {
        id: claim.component_id, knowledge_asset_id: asset.id, component_type: componentType,
        variant, version: claim.component_version, status: 'ready', body: claim.component_body,
        source_hash: sourceHash, prompt_version: promptVersion,
      }, reused: true };
    }
    throw new Error('COMPONENT_GENERATION_IN_PROGRESS:' + componentType);
  }

  try {
    const body = await generatePackageComponent(asset, componentType);
    const { data: saved, error: saveError } = await supabase.from('ka_components')
      .update({ status: 'ready', body, generated_by: 'llm-fallback-chain',
        locked_until: null, last_error: null, updated_at: new Date().toISOString() })
      .eq('id', claim.component_id).eq('status', 'generating').select('*').single();
    if (saveError || !saved) throw saveError || new Error('Component claim expired before save');
    return { component: saved, reused: false };
  } catch (error) {
    await supabase.from('ka_components').update({
      status: 'failed', last_error: String(error && error.message || error).slice(0, 2000),
      locked_until: null, updated_at: new Date().toISOString(),
    }).eq('id', claim.component_id).eq('status', 'generating');
    throw error;
  }
}

export async function getOrGenerateComponent(assetId, componentType, options = {}) {
  const supabase = createAdminClient();
  const { data: asset, error } = await supabase.from('knowledge_assets').select('*').eq('id', assetId).single();
  if (error || !asset) throw new Error('Knowledge Asset not found');
  return getOrGenerateComponentForAsset(asset, componentType, options);
}

export async function recordComponentUse(componentId, consumerType, consumerId) {
  if (!componentId || !consumerType || !consumerId) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from('ka_component_uses').insert({
    component_id: componentId, consumer_type: consumerType, consumer_id: consumerId,
  });
  if (error) console.error('Failed to record KA component use:', error.message);
}

export async function listAssetComponents(assetId) {
  const supabase = createAdminClient();
  const results = await Promise.all([
    supabase.from('knowledge_assets').select('*').eq('id', assetId).single(),
    supabase.from('ka_components').select('*').eq('knowledge_asset_id', assetId)
      .order('component_type').order('version', { ascending: false }),
  ]);
  const asset = results[0].data;
  const components = results[1].data;
  if (results[0].error || !asset) throw new Error('Knowledge Asset not found');
  if (results[1].error) throw results[1].error;
  const latest = new Map();
  (components || []).forEach((item) => {
    const key = item.component_type + ':' + item.variant;
    if (!latest.has(key)) latest.set(key, item);
  });
  return {
    asset: { id: asset.id, keyword: asset.keyword, subject: asset.subject },
    components: Array.from(latest.values()).map((item) => ({
      ...item, stale: item.status === 'ready' && !isComponentFresh(item, asset),
    })),
  };
}
