import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateJson } from '@/lib/content-factory/generators/_shared';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [{ data, error }, { data: knowledgeAssets, error: knowledgeError }] = await Promise.all([
      supabase.from('content_assets').select('id, title, body, metadata, status, created_at, knowledge_assets(keyword)').eq('asset_type', 'video_script').order('created_at', { ascending: false }).limit(40),
      supabase.from('knowledge_assets').select('id, keyword, subject').order('keyword').limit(500),
    ]);
    if (error) throw error;
    if (knowledgeError) throw knowledgeError;
    return NextResponse.json({ success: true, scripts: data || [], knowledgeAssets: knowledgeAssets || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not load saved scripts.' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;

const FORMATS = ['explainer', 'whiteboard', 'question', 'story', 'tegaki'];
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export async function POST(request) {
  try {
    const body = await request.json();
    const knowledgeAssetId = clean(body.knowledgeAssetId, 80);
    const formats = [...new Set((Array.isArray(body.formats) ? body.formats : []).filter((x) => FORMATS.includes(x)))];
    if (!knowledgeAssetId) return NextResponse.json({ error: 'Choose a Knowledge Asset first.' }, { status: 400 });
    if (!formats.length) return NextResponse.json({ error: 'Choose at least one video format.' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets').select('*').eq('id', knowledgeAssetId).single();
    if (assetError || !asset) return NextResponse.json({ error: 'Knowledge Asset not found.' }, { status: 404 });

    const source = JSON.stringify({
      topic: asset.keyword,
      subject: asset.subject,
      definitions: asset.definitions,
      key_concepts: asset.key_concepts,
      learning_objectives: asset.learning_objectives,
      sub_topics: asset.sub_topics,
      notes: asset.content || asset.description,
    });

    const prompt = `You are the senior instructional scriptwriter for Shiney Brain Academy. Create one script for EACH requested video format in a SINGLE generation. Source knowledge asset (use as the factual source): ${source}
Requested formats: ${formats.join(', ')}.
Teach Nigerian secondary-school/JAMB learners. Be scientifically accurate, engaging, clear and moderately detailed: not childish or oversimplified, but easy for a mid-school student to understand. Use clear Nigerian English, never pidgin. Do not invent facts absent from the source; use standard established science only when needed to explain.
For each format, create 3–6 scenes except Tegaki, which must be ONE continuous page/scene with a complete lesson text and 2–5 illustration cues timed across the narration. Whiteboard needs scene-specific visual cues and concise spoken narration. Question format must include one JAMB-style multiple-choice question, four options and answer/explanation. Story must teach the same topic through a compelling short narrative with a clear climax and takeaway. Return valid JSON only:
{"scripts":[{"format":"explainer","title":"...","scenes":[{"heading":"...","text":"...","narration":"...","visual_cue":"...","durationSeconds":8,"options":[],"answer":"","explanation":""}],"illustrationCues":[{"at":0,"label":"...","illustration":"animal-cell"}]}]}
Only return formats requested. Do not return code, markdown or SVG.`;

    const generated = await generateJson(prompt, { expect: 'object', maxTokens: 6500 });
    if (!Array.isArray(generated.scripts)) throw new Error('The batch planner returned an invalid result.');
    const byFormat = new Map(generated.scripts.map((item) => [item.format, item]));
    const saved = [];
    for (const format of formats) {
      const item = byFormat.get(format);
      if (!item || !Array.isArray(item.scenes) || !item.scenes.length) {
        saved.push({ format, error: 'No usable script was returned for this format.' });
        continue;
      }
      const scenes = item.scenes.slice(0, format === 'tegaki' ? 1 : 8).map((scene, index) => ({
        heading: clean(scene.heading, 120) || `Scene ${index + 1}`,
        text: clean(scene.text || scene.narration, 2200),
        narration: clean(scene.narration || scene.text, 1200),
        visual_cue: clean(scene.visual_cue || scene.heading, 240),
        stock_search: clean(scene.visual_cue || scene.heading, 160),
        durationSeconds: Math.max(5, Math.min(45, Number(scene.durationSeconds) || (format === 'tegaki' ? 40 : 8))),
        options: Array.isArray(scene.options) ? scene.options.slice(0, 4).map((x) => clean(x, 180)) : [],
        answer: clean(scene.answer, 240),
        explanation: clean(scene.explanation, 800),
      }));
      if (format === 'tegaki' && !Array.isArray(item.illustrationCues)) {
        item.illustrationCues = [{ at: 0, label: 'Main concept', illustration: 'animal-cell' }];
      }
      const title = clean(item.title, 160) || `${asset.keyword} — ${format}`;
      const { data: contentAsset, error: contentError } = await supabase.from('content_assets').insert({
        knowledge_asset_id: knowledgeAssetId,
        asset_type: 'video_script',
        platform: null,
        format: 'video',
        title,
        body: scenes.map((s) => s.text || s.narration).join('\n\n'),
        metadata: { video_format: format, scenes, illustration_cues: item.illustrationCues || [], source: 'video-studio-batch' },
        status: 'draft',
        generated_by: 'video-studio-batch',
      }).select().single();
      if (contentError) throw contentError;

      saved.push({
        format, title, contentAssetId: contentAsset.id,
        saved: true,
        scenes,
        illustrationCues: item.illustrationCues || [],
      });
    }

    return NextResponse.json({ success: true, knowledgeAsset: asset.keyword, saved, generatedInOneCall: true });
  } catch (error) {
    console.error('Video Studio batch generation failed:', error);
    return NextResponse.json({ error: error.message || 'Could not generate the batch.' }, { status: 500 });
  }
}
