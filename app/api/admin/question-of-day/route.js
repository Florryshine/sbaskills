import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';

export const runtime = 'nodejs';
export const maxDuration = 60;
const BUCKET = 'sba-question-of-day';
const W = 1014;
const H = 1536;

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function wrap(v, max) {
  const words = String(v || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (next.length > max && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
function drawLines(lines, x, y, lh, size, color) {
  return lines.map((line, i) => '<text x="' + x + '" y="' + (y + i * lh) + '" font-family="Arial, Helvetica, sans-serif" font-size="' + size + '" font-weight="600" fill="' + color + '">' + esc(line) + '</text>').join('');
}
async function renderQuestion(template, q) {
  const base = await sharp(template).rotate().resize(W, H, { fit: 'fill' }).png().toBuffer();
  const qLines = wrap(q.question, 31);
  let y = 555 + qLines.length * 43 + 48;
  let options = '';
  for (const o of q.options) {
    const lines = wrap(o.text, 27);
    options += '<circle cx="525" cy="' + (y - 11) + '" r="20" fill="#1761ce"/>';
    options += '<text x="525" y="' + (y - 3) + '" text-anchor="middle" font-family="Arial" font-size="23" font-weight="700" fill="#fff">' + esc(o.id) + '</text>';
    options += drawLines(lines, 565, y, 36, 27, '#123b83');
    y += Math.max(1, lines.length) * 36 + 32;
  }
  const svg = '<svg width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg">' +
    '<polygon points="423,386 1012,382 1012,1288 423,1288" fill="#fff"/>' +
    '<rect x="444" y="414" width="240" height="78" rx="8" fill="#ffdf24"/>' +
    '<text x="564" y="464" text-anchor="middle" font-family="Arial" font-size="39" font-weight="700" font-style="italic" fill="#164a9c">' + esc(String(q.subject || 'JAMB').toUpperCase()) + '</text>' +
    '<path d="M490 510 H850" stroke="#1c58b7" stroke-width="4" stroke-linecap="round"/>' +
    '<text x="455" y="548" font-family="Arial" font-size="29" font-weight="700" fill="#164a9c">QUESTION OF THE DAY</text>' +
    drawLines(qLines, 500, 600, 43, 34, '#123b83') + options +
    '<text x="735" y="1220" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" font-style="italic" fill="#164a9c">Think Before You Choose!</text>' +
    '<path d="M625 1240 Q735 1260 845 1238" stroke="#ffcf00" stroke-width="8" fill="none" stroke-linecap="round"/>' +
    '</svg>';
  return sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}
async function generateQuestion(asset, difficulty) {
  const prompt = 'You are an expert Nigerian JAMB examiner. Write ONE original, accurate JAMB-style MCQ for Shiney Brain Academy.\n' +
    'TOPIC: ' + asset.keyword + '\nSUBJECT: ' + (asset.subject || 'General') +
    '\nREFERENCE SUMMARY: ' + (asset.summary || 'Use established syllabus knowledge.') +
    '\nKEY CONCEPTS: ' + (asset.key_concepts || []).slice(0, 8).join('; ') +
    '\nFACTS: ' + (asset.facts || []).slice(0, 8).join('; ') + '\nDIFFICULTY: ' + difficulty +
    '\nRequirements: meaningful conceptual test; exactly four plausible options A-D; exactly one correct answer; no all/none of the above; avoid ambiguity; question preferably under 25 words; options ideally under 10 words each; explanation 2-4 accurate sentences. This is an original JAMB-style practice question, NOT a claim that it appeared in an official past paper. Return only JSON: ' +
    '{"question":"...","options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correctOptionId":"A","explanation":"..."}';
  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, 'object'),
    (q) => q && typeof q.question === 'string' && q.question.trim() &&
      Array.isArray(q.options) && q.options.length === 4 &&
      ['A','B','C','D'].every((id) => q.options.some((o) => o && o.id === id && typeof o.text === 'string' && o.text.trim())) &&
      ['A','B','C','D'].includes(q.correctOptionId) && typeof q.explanation === 'string' && q.explanation.trim(),
    1600
  );
  if (!result) throw new Error('Question generation failed across providers. ' + (errors || []).join('; '));
  return { ...result, subject: asset.subject || 'General', topic: asset.keyword, difficulty };
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('content_assets')
      .select('id,title,body,status,metadata,created_at,media_files(id,url,width,height)')
      .eq('asset_type', 'question_of_the_day').order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const knowledgeAssetId = body.knowledgeAssetId;
    const difficulty = ['Easy','Medium','Hard'].includes(body.difficulty) ? body.difficulty : 'Hard';
    if (!knowledgeAssetId) return NextResponse.json({ error: 'Choose a topic from Knowledge Assets first.' }, { status: 400 });
    const supabase = createAdminClient();
    const { data: asset, error: assetError } = await supabase.from('knowledge_assets').select('*').eq('id', knowledgeAssetId).single();
    if (assetError || !asset) return NextResponse.json({ error: 'Knowledge asset not found.' }, { status: 404 });
    const { data: template, error: templateError } = await supabase.storage.from(BUCKET).download('templates/classroom-template.jpg');
    if (templateError || !template) return NextResponse.json({ error: 'Upload the classroom template once before generating.' }, { status: 400 });

    const question = await generateQuestion(asset, difficulty);
    const imageBuffer = await renderQuestion(Buffer.from(await template.arrayBuffer()), question);
    const imagePath = 'generated/' + Date.now() + '-' + crypto.randomUUID() + '.jpg';
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(imagePath, imageBuffer, { contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;
    const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(imagePath).data.publicUrl;
    const caption = 'Can you solve today’s ' + question.subject + ' question? Drop your answer in the comments.\n\nFollow Shiney Brain Academy for daily JAMB practice.\n\n#ShineyBrainAcademy #JAMB #UTME #JAMB2027 #QuestionOfTheDay';
    const metadata = {
      subject: question.subject, topic: question.topic, difficulty: question.difficulty,
      options: question.options, correctOptionId: question.correctOptionId,
      explanation: question.explanation, image_url: imageUrl, storage_path: imagePath, caption
    };
    const { data: content, error: contentError } = await supabase.from('content_assets').insert({
      knowledge_asset_id: knowledgeAssetId, asset_type: 'question_of_the_day', platform: null,
      format: 'image', title: question.subject + ' Question of the Day', body: question.question,
      status: 'draft', generated_by: 'sba-question-of-the-day-engine', metadata
    }).select().single();
    if (contentError) throw contentError;
    const { error: mediaError } = await supabase.from('media_files').insert({
      content_asset_id: content.id, media_type: 'image', role: 'primary', position: 0,
      url: imageUrl, storage_path: imagePath, width: W, height: H,
      file_size_bytes: imageBuffer.length, mime_type: 'image/jpeg', source: 'render',
      alt_text: question.subject + ' JAMB practice question from Shiney Brain Academy'
    });
    if (mediaError) throw mediaError;
    return NextResponse.json({ success: true, question: { ...question, id: content.id, imageUrl, caption } });
  } catch (error) {
    console.error('Question of the Day generation failed:', error);
    return NextResponse.json({ error: error.message || 'Generation failed.' }, { status: 500 });
  }
}
