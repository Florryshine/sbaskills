import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const scheduleNext = (request, secret) => waitUntil((async () => {
  await new Promise(resolve => setTimeout(resolve, 1200));
  try { await fetch(new URL('/api/internal/curriculum-worker', request.url), { method: 'POST', headers: { authorization: `Bearer ${secret}` } }); } catch (error) { console.error('Could not continue curriculum worker chain:', error); }
})());

const clean = (value, max = 600) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const parseJson = value => JSON.parse(String(value || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim());
const withTimeout = (promise, ms, message) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })])
    .finally(() => clearTimeout(timer));
};

async function extractChunk(text, subject, index, total) {
  const prompt = `Extract ONLY syllabus information explicitly present below. Do not invent topics or objectives. Subject: ${subject}; chunk ${index + 1}/${total}. Return JSON only: {"topics":[{"title":"main topic","code":"","description":"source-faithful brief description","objectives":["explicit learning objective"],"subtopics":[{"title":"subtopic","code":"","objectives":["explicit objective"]}]}]}. Preserve source numbering where available. Ignore headers/footers. If there are no clear topics, return {"topics":[]}. SOURCE:
${text}`;
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
      .eq('curriculum_topic_id', topic.id).eq('objective_text', objective).limit(1).maybeSingle();
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

    const { data: sourceDoc, error: sourceError } = await admin.from('curriculum_source_documents')
      .select('id,file_name,file_type,storage_path,extracted_text').eq('id', job.document_id).maybeSingle();
    if (sourceError) throw sourceError;
    if (!sourceDoc) throw new Error('Curriculum source document no longer exists.');

    if (!sourceDoc.extracted_text || sourceDoc.extracted_text.trim().length < 50) {
      try {
        if (!sourceDoc.storage_path) throw new Error('No stored file is available for extraction.');
        const { data: file, error: downloadError } = await admin.storage.from('curriculum-sources').download(sourceDoc.storage_path);
        if (downloadError) throw downloadError;
        if (!file) throw new Error('Source file could not be downloaded from Storage.');
        const buffer = Buffer.from(await file.arrayBuffer());
        if (!buffer.length || buffer.length > 15 * 1024 * 1024) throw new Error('File is empty or exceeds the 15MB upload limit.');
        const name = String(sourceDoc.file_name || '').toLowerCase();
        const type = String(sourceDoc.file_type || '').toLowerCase();
        let extracted = '';
        if (type === 'application/pdf' || name.endsWith('.pdf')) {
          const { getData } = await import('pdf-parse/worker');
          const { PDFParse } = await import('pdf-parse');
          PDFParse.setWorker(getData());
          const parser = new PDFParse({ data: buffer });
          try { extracted = String((await withTimeout(parser.getText(), 52000, 'PDF text extraction exceeded the 52-second worker limit.'))?.text || '').trim(); }
          finally { await parser.destroy(); }
        } else if (name.endsWith('.txt') || name.endsWith('.csv') || type.startsWith('text/')) {
          extracted = buffer.toString('utf8').trim();
        } else if (name.endsWith('.docx') || type.includes('wordprocessingml')) {
          const mammoth = await import('mammoth');
          extracted = String((await mammoth.extractRawText({ buffer })).value || '').trim();
        } else if (/\.(xlsx|xls)$/.test(name) || type.includes('spreadsheet') || type.includes('excel')) {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          extracted = workbook.SheetNames.map(sheet => XLSX.utils.sheet_to_csv(workbook.Sheets[sheet])).join('\n\n').trim();
        } else throw new Error('Unsupported source file type.');
        if (extracted.length < 50) throw new Error('Too little readable text was extracted. Scanned PDFs require OCR or pasted text.');
        const { error: saveTextError } = await admin.from('curriculum_source_documents').update({
          extracted_text: extracted, extracted_chars: extracted.length, status: 'processing',
          notes: `Background text extraction succeeded (${extracted.length.toLocaleString()} characters). Building syllabus chunks next.`,
          updated_at: new Date().toISOString(),
        }).eq('id', job.document_id);
        if (saveTextError) throw saveTextError;
        const extractedChunks = [];
        let remaining = extracted;
        while (remaining.length > 6000) {
          let splitAt = remaining.lastIndexOf('\n', 6000);
          if (splitAt < 3000) splitAt = 6000;
          extractedChunks.push(remaining.slice(0, splitAt));
          remaining = remaining.slice(splitAt).trimStart();
        }
        if (remaining.trim()) extractedChunks.push(remaining);
        const { error: prepareError } = await admin.from('curriculum_processing_jobs').update({
          chunks: extractedChunks, total_chunks: extractedChunks.length, next_chunk_index: 0,
          status: 'queued', locked_until: null, last_error: null,
          attempts: { ...(job.attempts || {}), extract: 0 }, updated_at: new Date().toISOString(),
        }).eq('id', job.id);
        if (prepareError) throw prepareError;
        scheduleNext(request, expected);
        return NextResponse.json({ success: true, worked: true, job_id: job.id, phase: 'extracted', extracted_chars: extracted.length, total_chunks: extractedChunks.length });
      } catch (extractError) {
        const attempts = { ...(job.attempts || {}), extract: Number(job.attempts?.extract || 0) + 1 };
        const retry = attempts.extract < 3;
        const message = String(extractError?.message || extractError).slice(0, 900);
        await admin.from('curriculum_processing_jobs').update({
          attempts, status: retry ? 'queued' : 'failed', locked_until: null, last_error: message,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id);
        await admin.from('curriculum_source_documents').update({
          status: retry ? 'processing' : 'failed',
          notes: `Background extraction ${retry ? 'failed and will retry' : 'failed after 3 attempts'}: ${message}`,
          updated_at: new Date().toISOString(),
        }).eq('id', job.document_id);
        if (retry) scheduleNext(request, expected);
        return NextResponse.json({ success: false, worked: true, phase: 'extract', retry, error: message });
      }
    }

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
      if (!completed) scheduleNext(request, expected);
      return NextResponse.json({ success: true, worked: true, job_id: job.id, chunk: next, total_chunks: chunks.length, status: nextStatus, stats });
    } catch (chunkError) {
      const attempts = { ...(job.attempts || {}) };
      attempts[String(index)] = Number(attempts[String(index)] || 0) + 1;
      const retry = attempts[String(index)] < 3;
      const message = String(chunkError?.message || chunkError).slice(0, 900);
      const status = retry ? 'queued' : 'failed';
      await admin.from('curriculum_processing_jobs').update({
        attempts, status, last_error: message, locked_until: null, updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      await admin.from('curriculum_source_documents').update({
        status: retry ? 'processing' : 'failed',
        notes: `Chunk ${index + 1}/${chunks.length} ${retry ? 'failed and will retry' : 'failed after 3 attempts'}: ${message}`,
        updated_at: new Date().toISOString(),
      }).eq('id', job.document_id);
      if (retry) scheduleNext(request, expected);
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
