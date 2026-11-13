import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';
import { renderNotebookImage } from '@/lib/notebook-studio/render';

export const maxDuration = 300;

const CATEGORIES = [
  { key: 'topic_of_the_day', label: 'Topic of the Day', instruction: 'Create a clear mini-lesson introducing a JAMB topic, why it matters, and 3 key learning points.' },
  { key: 'question_of_the_day', label: 'Question of the Day', instruction: 'Create one challenging JAMB-style multiple-choice question with four plausible options A-D, the correct answer, and a concise explanation. Put the answer in a clearly labelled Answer section at the end.' },
  { key: 'fact_of_the_day', label: 'Fact of the Day', instruction: 'Create one surprising but verifiable subject fact, explain why it is true, and add one useful takeaway.' },
  { key: 'lesson_note', label: 'Lesson Notes', instruction: 'Create concise, well-structured JAMB lesson notes with definitions, key points, examples and a short check-your-understanding question.' },
  { key: 'quick_revision', label: 'Quick Revision', instruction: 'Create a compact last-minute revision sheet with must-know facts, formulas or rules where relevant, and common exam traps.' },
  { key: 'exam_tips', label: 'Exam Tips', instruction: 'Create practical JAMB examination advice specific to this subject/topic. Avoid generic motivational filler.' },
];

function clean(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim();
}

function buildPrompt(category, assets) {
  const source = assets.map((asset, index) => ({
    slot: index + 1,
    knowledgeAssetId: asset.id,
    topic: asset.keyword,
    subject: asset.subject,
    summary: asset.summary,
    keyConcepts: asset.key_concepts || [],
    definitions: asset.definitions || [],
    examples: asset.examples || [],
    facts: asset.facts || [],
    commonMistakes: asset.common_mistakes || [],
  }));
  return `You are the academic content editor for Shiney Brain Academy, a Nigerian JAMB preparation platform.
Create exactly ${assets.length} distinct social-learning notebook posts for the category "${category.label}".
For each item, use the corresponding source slot below. Keep every claim scientifically/academically accurate and appropriate for JAMB candidates. Do not invent facts, formulas, syllabus claims, or past-question provenance. If the source material is insufficient for a factual claim, stay within what it supports.
Category-specific instruction: ${category.instruction}

Source slots (each output item must use the matching slot number):
${JSON.stringify(source)}

Requirements:
- Every item must be useful on its own and clearly focused on its assigned topic.
- Avoid repeating the same explanation or question angle.
- Keep content short enough for one notebook image: title up to 9 words; content 45-100 words; use short lines/bullets.
- For Question of the Day, include exactly four options and one correct answer with explanation.
- Use plain text, no markdown tables, no HTML, no emojis, no hashtags.
- Return exactly ${assets.length} items in the same slot order.

Return ONLY JSON:
{"items":[{"slot":1,"title":"...","content":"..."}]}`;
}

function validBatch(value, count) {
  return value && Array.isArray(value.items) && value.items.length === count &&
    value.items.every((item, index) => item && item.slot === index + 1 &&
      typeof item.title === 'string' && item.title.trim() &&
      typeof item.content === 'string' && item.content.trim().length >= 35);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const subjects = Array.isArray(body.subjects) ? [...new Set(body.subjects.map(clean).filter(Boolean))] : [];
    const template = ['classic', 'premium', 'revision'].includes(body.template) ? body.template : 'classic';
    const perCategory = Math.min(5, Math.max(1, Number(body.perCategory) || 5));
    if (!subjects.length) return NextResponse.json({ error: 'Select at least one subject.' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: allAssets, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('id, keyword, subject, summary, key_concepts, definitions, examples, facts, common_mistakes, exam_type')
      .in('subject', subjects)
      .contains('exam_type', ['JAMB'])
      .order('created_at', { ascending: false })
      .limit(250);

    if (assetError) throw assetError;
    if (!allAssets?.length) return NextResponse.json({ error: 'No JAMB Knowledge Assets were found for the selected subjects.' }, { status: 404 });

    const assetsBySubject = new Map(subjects.map((subject) => [subject, allAssets.filter((asset) => asset.subject === subject)]));
    const chosenAssets = Array.from({ length: perCategory }, (_, index) => {
      const subject = subjects[index % subjects.length];
      const pool = assetsBySubject.get(subject) || [];
      return pool[index % Math.max(1, pool.length)] || allAssets[index % allAssets.length];
    }).filter(Boolean);

    if (chosenAssets.length < perCategory) {
      return NextResponse.json({ error: `Only ${chosenAssets.length} suitable topics were found; ${perCategory} are required.` }, { status: 422 });
    }

    const batchId = crypto.randomUUID();
    const results = [];
    const failures = [];

    for (const category of CATEGORIES) {
      try {
        const prompt = buildPrompt(category, chosenAssets);
        const { result, usedProvider, errors } = await generateWithFallback(
          prompt,
          (text) => { try { return parseJsonFromText(text, 'object'); } catch { return null; } },
          (parsed) => validBatch(parsed, perCategory),
          4096
        );
        if (!result) throw new Error(errors?.join('; ') || 'Content generation failed.');

        for (let index = 0; index < result.items.length; index++) {
          const item = result.items[index];
          const asset = chosenAssets[index];
          let contentAssetId = null;
          try {
            const { data: inserted, error: insertError } = await supabase
              .from('content_assets')
              .insert({
                knowledge_asset_id: asset.id,
                asset_type: 'notebook_post',
                platform: null,
                format: 'image',
                title: item.title.trim(),
                body: item.content.trim(),
                metadata: {
                  notebookStudio: true,
                  batchId,
                  category: category.key,
                  categoryLabel: category.label,
                  subject: asset.subject,
                  topic: asset.keyword,
                  exam: 'JAMB',
                  template,
                  generationProvider: usedProvider || null,
                },
                status: 'draft',
                generated_by: usedProvider || 'content-engine',
              })
              .select('id')
              .single();
            if (insertError) throw insertError;
            contentAssetId = inserted.id;

            const image = await renderNotebookImage({
              title: item.title,
              content: item.content,
              subject: asset.subject,
              topic: asset.keyword,
              template,
              category: category.label,
            });
            const storagePath = `notebook-studio/${batchId}/${contentAssetId}.png`;
            const { error: uploadError } = await supabase.storage
              .from('carousel-slides')
              .upload(storagePath, image, { contentType: 'image/png', upsert: true });
            if (uploadError) throw uploadError;
            const { data: publicUrl } = supabase.storage.from('carousel-slides').getPublicUrl(storagePath);

            const { error: mediaError } = await supabase.from('media_files').insert({
              content_asset_id: contentAssetId,
              media_type: 'image',
              role: 'primary',
              position: 0,
              url: publicUrl.publicUrl,
              storage_path: storagePath,
              width: 1200,
              height: 1600,
              file_size_bytes: image.length,
              mime_type: 'image/png',
              source: 'render',
              alt_text: `${category.label}: ${item.title}`,
            });
            if (mediaError) throw mediaError;
            results.push({ id: contentAssetId, title: item.title, subject: asset.subject, topic: asset.keyword, category: category.key, imageUrl: publicUrl.publicUrl, status: 'draft' });
          } catch (itemError) {
            failures.push({ category: category.key, topic: asset.keyword, contentAssetId, error: itemError.message });
          }
        }
      } catch (categoryError) {
        failures.push({ category: category.key, error: categoryError.message });
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      batchId,
      requested: CATEGORIES.length * perCategory,
      generated: results.length,
      failed: failures.length,
      results,
      failures,
    });
  } catch (error) {
    console.error('Notebook Studio batch generation failed:', error);
    return NextResponse.json({ error: error.message || 'Notebook batch generation failed.' }, { status: 500 });
  }
}
