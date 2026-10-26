import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const clean = (value, max = 600) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const parseJson = value => JSON.parse(String(value || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim());
const withTimeout = (promise, ms, message) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })])
    .finally(() => clearTimeout(timer));
};

async function extractChunk(text, subject, index, total) {
  const prompt = `Extract ONLY syllabus information explicitly present below. Do not invent topics or objectives. Subject: ${subject}; chunk ${index + 1}/${total}. Return JSON only: {"topics":[{"title":"main topic","code":"","description":"source-faithful brief description","objectives":["explicit learning objective"],"subtopics":[{"title":"subtopic","code":"","objectives":["explicit objective"]}]}]}. Preserve source numbering where available. Ignore headers/footers. If there are no clear topics, return {"topics":[]}. SOURCE:\n${text}`;
  const result = await withTimeout(generateWithFallback(prompt, parseJson, value => value && Array.isArray(value.topics), 3500), 18000, 'AI syllabus extraction exceeded the 18-second chunk timeout.');
  if (!result?.result || !Array.isArray(result.result.topics)) throw new Error('AI response did not contain a valid topics array');
  return result.result.topics;
}

async function upsertTopic(admin, job, title, parentId, type, item, order, sourceExcerpt) {
  const safeTitle = clean(title, 250);
  if (!safeTitle) return null;
  let query = admin.from('curriculum_topics').select('id,title,parent_id,knowledge_asset_id').eq('curriculum_id', job.curriculum_id).eq('subject', job.subject).eq('title', safeTitle);
  query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);
  const { data: existing, error: lookupError } = await query.maybeSingle();
  if (lookupError) throw lookupError;
  let topic = existing;
  if (!topic) {
    const { data, error } = await admin.from('curriculum_topics').insert({
      curriculum_id: job.curriculum_id, subject: job.subject, title: safeTitle,
      order_index: order, parent_id: parentId || null, node_type: type,
      code: clean(item?.code, 80) || null,
      description: clean(item?.description, 1800) || null,
      syllabus_text: clean(item?.description, 1800) || safeTitle,
      source: job.document_id,
    }).select('id,title,parent_id,knowledge_asset_id').single();
    if (error) throw error;
    topic = data;
  }

  const objectives = Array.isArray(item?.objectives) ? [...new Set(item.objectives.map(v => clean(v, 1000)).filter(Boolean))] : [];
  for (let i = 0; i < objectives.length; i++) {
    const objective = objectives[i];
    const { data: found, error: findError } = await admin.from('curriculum_objectives').select('id')
      .eq('curriculum_topic_id', topic.id).eq('objective_text', objective).maybeSingle();
    if (findError) throw findError;
    if (!found) {
      const { error } = await admin.from('curriculum_objectives').insert({
        curriculum_topic_id: topic.id, objective_text: objective, order_index: i + 1, source: job.document_id,
      });
      if (error && !/duplicate key/i.test(error.message || '')) throw error;
    }
  }

  // Find a matching asset without changing its keyword or overwriting authored content.
  const { data: assets, error: assetLookupError } = await admin.from('knowledge_assets')
    .select('id,keyword,summary,raw_content,learning_objectives,subject,status,topic_type')
    .eq('keyword', safeTitle).eq('subject', job.subject).limit(10);
  if (assetLookupError) throw assetLookupError;
  let asset = (assets || []).find(a => ['learning','curriculum_topic','information'].includes(a.topic_type)) || null;
  if (!asset) {
    const { data: created, error: createError } = await admin.from('knowledge_assets').insert({
      keyword: safeTitle,
      topic_type: 'curriculum_topic',
      subject: job.subject,
      summary: clean(item?.description, 1200) || null,
      raw_content: clean(sourceExcerpt, 5000) || null,
      learning_objectives: objectives,
      key_concepts: [],
      definitions: [],
      examples: [],
      facts: [],
      common_mistakes: [],
      sub_topics: [],
      exam_type: ['JAMB'],
      prerequisite_ids: [],
      related_asset_ids: [],
      status: 'draft',
      source: 'curriculum_import:' + job.document_id,
    }).select('id,keyword,summary,raw_content,learning_objectives,subject,status,topic_type').single();
    if (createError) throw createError;
    asset = created;
  } else if ((!Array.isArray(asset.learning_objectives) || asset.learning_objectives.length === 0) && objectives.length) {
    const { error } = await admin.from('knowledge_assets').update({ learning_objectives: objectives, updated_at: new Date().toISOString() }).eq('id', asset.id);
    if (error) throw error;
  }

  const { error: bridgeError } = await admin.from('curriculum_topic_assets').upsert({
    curriculum_topic_id: topic.id, knowledge_asset_id: asset.id, relationship: parentId ? 'supporting' : 'primary',
    source: 'curriculum_import:' + job.document_id, updated_at: new Date().toISOString(),
  }, { onConflict: 'curriculum_topic_id,knowledge_asset_id' });
  if (bridgeError) throw bridgeError;

  // Keep the existing direct link populated where the current schema permits it.
  if (!topic.knowledge_asset_id) {
    const { error } = await admin.from('curriculum_topics').update({ knowledge_asset_id: asset.id }).eq('id', topic.id);
    if (error && !/knowledge_asset_id|foreign key|violates foreign key/i.test(error.message || '')) throw error;
  }
  return { topicCreated: !existing, assetCreated: !(assets || []).some(a => a.id === asset.id), objectivesCount: objectives.length };
}

export async function POST(request) {
  const expected = process.env.CURRICULUM_WORKER_SECRET;
  if (!expected) return NextResponse.json({ error: 'CURRICULUM_WORKER_SECRET is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${expected}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  let job = null;
  try {
    const { data: jobs, error: claimError } = await admin.rpc('claim_curriculum_processing_job');
    if (claimError) throw claimError;
    job = Array.isArray(jobs) ? jobs[0] : null;
    if (!job) return NextResponse.json({ success: true, worked: false, message: 'No queued curriculum chunks.' });

    const index = job.next_chunk_index;
    const chunks = Array.isArray(job.chunks) ? job.chunks : [];
    if (index >= chunks.length) {
      await admin.from('curriculum_processing_jobs').update({ status: 'completed', locked_until: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id);
      await admin.from('curriculum_source_documents').update({ status: 'published', notes: 'Syllabus build completed; knowledge assets linked.', updated_at: new Date().toISOString() }).eq('id', job.document_id);
      return NextResponse.json({ success: true, worked: true, job_id: job.id, status: 'completed' });
    }

    try {
      const topics = await extractChunk(chunks[index], job.subject, index, chunks.length);
      const stats = { ...(job.stats || {}), topics_added: Number(job.stats?.topics_added || 0), topics_already_existing: Number(job.stats?.topics_already_existing || 0), objectives_added: Number(job.stats?.objectives_added || 0), assets_created: Number(job.stats?.assets_created || 0), assets_linked: Number(job.stats?.assets_linked || 0) };
      for (let i = 0; i < topics.length; i++) {
        const item = topics[i];
        const title = clean(item?.title, 250);
        if (!title) continue;
        const result = await upsertTopic(admin, job, title, null, 'topic', item, index * 100 + i + 1, chunks[index]);
        if (!result) continue;
        if (result.topicCreated) stats.topics_added++; else stats.topics_already_existing++;
        if (result.assetCreated) stats.assets_created++;
        stats.assets_linked++;
        stats.objectives_added += result.objectivesCount;

        const subtopics = Array.isArray(item?.subtopics) ? item.subtopics : [];
        for (let si = 0; si < subtopics.length; si++) {
          const sub = subtopics[si];
          const subTitle = clean(sub?.title, 250);
          if (!subTitle) continue;
          const subResult = await upsertTopic(admin, job, subTitle, (await admin.from('curriculum_topics').select('id').eq('curriculum_id', job.curriculum_id).eq('subject', job.subject).eq('title', title).is('parent_id', null).maybeSingle()).data?.id, 'subtopic', sub, si + 1, chunks[index]);
          if (subResult) {
            if (subResult.topicCreated) stats.topics_added++; else stats.topics_already_existing++;
            if (subResult.assetCreated) stats.assets_created++;
            stats.assets_linked++;
            stats.objectives_added += subResult.objectivesCount;
          }
        }
      }

      const next = index + 1;
      const completed = next >= chunks.length;
      const nextStatus = completed ? 'completed' : 'queued';
      const { error: saveError } = await admin.from('curriculum_processing_jobs').update({
        next_chunk_index: next, stats, status: nextStatus, locked_until: null, last_error: null,
        attempts: { ...(job.attempts || {}), [String(index)]: 0 },
        completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      if (saveError) throw saveError;
      await admin.from('curriculum_source_documents').update({
        status: completed ? 'published' : 'processing',
        notes: `Background syllabus build: ${next}/${chunks.length} chunks processed; ${stats.topics_added} topics/subtopics added, ${stats.assets_created} assets created, ${stats.assets_linked} topic-asset links.`,
        updated_at: new Date().toISOString(),
      }).eq('id', job.document_id);
      return NextResponse.json({ success: true, worked: true, job_id: job.id, chunk: next, total_chunks: chunks.length, status: nextStatus, stats });
    } catch (chunkError) {
      const attempts = { ...(job.attempts || {}) };
      attempts[String(index)] = Number(attempts[String(index)] || 0) + 1;
      const retry = attempts[String(index)] < 3;
      const message = String(chunkError?.message || chunkError).slice(0, 900);
      const status = retry ? 'queued' : 'partially_completed';
      await admin.from('curriculum_processing_jobs').update({
        attempts, status, last_error: message, locked_until: null, updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      await admin.from('curriculum_source_documents').update({
        status: retry ? 'processing' : 'failed',
        notes: `Chunk ${index + 1}/${chunks.length} ${retry ? 'failed and will retry' : 'failed after 3 attempts'}: ${message}`,
        updated_at: new Date().toISOString(),
      }).eq('id', job.document_id);
      return NextResponse.json({ success: false, worked: true, retry, job_id: job.id, chunk: index + 1, total_chunks: chunks.length, error: message }, { status: 200 });
    }
  } catch (error) {
    console.error('Curriculum worker failed:', error);
    if (job?.id) {
      await admin.from('curriculum_processing_jobs').update({
        status: 'queued', locked_until: null, last_error: String(error?.message || error).slice(0, 900), updated_at: new Date().toISOString(),
      }).eq('id', job.id);
    }
    return NextResponse.json({ error: error?.message || 'Curriculum worker failed.' }, { status: 500 });
  }
}
