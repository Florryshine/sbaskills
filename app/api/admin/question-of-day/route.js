import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
const BUCKET = 'sba-question-of-day';
const W = 1014;
const H = 1536;

function wrapText(ctx, value, maxWidth) {
  const words = String(value || '').trim().split(/\\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(ctx, value, x, y, maxWidth, lineHeight, maxFontSize, minFontSize = 20) {
  let fontSize = maxFontSize;
  let lines = [];
  while (fontSize >= minFontSize) {
    ctx.font = '600 ' + fontSize + 'px sans-serif';
    lines = wrapText(ctx, value, maxWidth);
    if (lines.every((line) => ctx.measureText(line).width <= maxWidth)) break;
    fontSize -= 2;
  }
  ctx.font = '600 ' + fontSize + 'px sans-serif';
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return { lines, fontSize, nextY: y + lines.length * lineHeight };
}

async function renderQuestion(template, q) {
  // Normalize orientation and dimensions first; then use the native Canvas renderer.
  // This avoids SVG/librsvg font substitution, which can turn text into tofu boxes
  // on serverless Linux even when the SVG itself composites successfully.
  const normalized = await sharp(template).rotate().resize(W, H, { fit: 'fill' }).png().toBuffer();
  const image = await loadImage(normalized);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, W, H);

  // The whiteboard is the only area intentionally replaced; the classroom photo stays intact.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(423, 386);
  ctx.lineTo(1012, 382);
  ctx.lineTo(1012, 1288);
  ctx.lineTo(423, 1288);
  ctx.closePath();
  ctx.fill();

  // A real Canvas text measurement + draw path, rather than SVG font resolution.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffdf24';
  ctx.fillRect(444, 414, 240, 78);
  ctx.fillStyle = '#164a9c';
  ctx.font = 'italic 700 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(q.subject || 'JAMB').toUpperCase(), 564, 464);
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#1c58b7';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(490, 510);
  ctx.lineTo(850, 510);
  ctx.stroke();

  ctx.fillStyle = '#164a9c';
  ctx.font = '700 28px sans-serif';
  ctx.fillText('QUESTION OF THE DAY', 455, 548);

  ctx.fillStyle = '#123b83';
  let cursorY = 600;
  const questionLayout = drawWrapped(ctx, q.question, 500, cursorY, 475, 42, 33, 23);
  cursorY = questionLayout.nextY + 34;

  for (const option of q.options) {
    const optionText = String(option.text || '');
    ctx.font = '600 26px sans-serif';
    const optionLines = wrapText(ctx, optionText, 405);
    const optionFont = optionLines.length > 2 ? 22 : 26;
    ctx.fillStyle = '#1761ce';
    ctx.beginPath();
    ctx.arc(525, cursorY - 9, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(option.id), 525, cursorY - 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#123b83';
    ctx.font = '600 ' + optionFont + 'px sans-serif';
    const lineHeight = optionFont + 9;
    optionLines.forEach((line, index) => ctx.fillText(line, 565, cursorY + index * lineHeight));
    cursorY += Math.max(1, optionLines.length) * lineHeight + 24;
  }

  ctx.fillStyle = '#164a9c';
  ctx.font = 'italic 700 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Think Before You Choose!', 735, 1220);
  ctx.strokeStyle = '#ffcf00';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(625, 1240);
  ctx.quadraticCurveTo(735, 1260, 845, 1238);
  ctx.stroke();

  // Fail loudly instead of saving a blank/broken render if the Canvas text engine is unavailable.
  ctx.font = '700 32px sans-serif';
  const textWidth = ctx.measureText('SHINEY BRAIN').width;
  if (!Number.isFinite(textWidth) || textWidth < 1) {
    throw new Error('Image text renderer failed its font measurement check.');
  }
  return canvas.toBuffer('image/jpeg', 92);
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
    const supabase = createAdminClient();
    let question;

    if (body.questionId) {
      const { data: row, error } = await supabase.from('past_questions')
        .select('*').eq('id', body.questionId).single();
      if (error || !row) return NextResponse.json({ error: 'Question not found in the question bank.' }, { status: 404 });
      question = {
        question: row.question,
        subject: row.subject || 'JAMB',
        topic: row.topic || 'Practice',
        difficulty: row.difficulty ? (row.difficulty >= 4 ? 'Hard' : row.difficulty >= 2 ? 'Medium' : 'Easy') : 'Practice',
        options: [
          { id: 'A', text: row.option_a || '' },
          { id: 'B', text: row.option_b || '' },
          { id: 'C', text: row.option_c || '' },
          { id: 'D', text: row.option_d || '' }
        ].filter(o => o.text.trim()),
        correctOptionId: String(row.correct_answer || '').toUpperCase(),
        explanation: row.explanation || ''
      };
    } else {
      const options = ['A','B','C','D'].map((id, i) => ({ id, text: String(body['option_' + id] || '').trim() })).filter(o => o.text);
      question = {
        question: String(body.question || '').trim(),
        subject: String(body.subject || 'JAMB').trim(),
        topic: String(body.topic || 'Practice').trim(),
        difficulty: 'Manual',
        options,
        correctOptionId: String(body.correctOptionId || '').toUpperCase(),
        explanation: String(body.explanation || '').trim()
      };
    }

    if (!question.question || question.options.length < 2) {
      return NextResponse.json({ error: 'Add a question and at least two answer options.' }, { status: 400 });
    }
    if (!['A','B','C','D'].includes(question.correctOptionId) || !question.options.some(o => o.id === question.correctOptionId)) {
      return NextResponse.json({ error: 'Select the correct answer.' }, { status: 400 });
    }

    const { data: template, error: templateError } = await supabase.storage.from(BUCKET).download('templates/classroom-template.jpg');
    if (templateError || !template) return NextResponse.json({ error: 'Upload the classroom template once before rendering.' }, { status: 400 });

    const imageBuffer = await renderQuestion(Buffer.from(await template.arrayBuffer()), question);
    const imagePath = 'generated/' + Date.now() + '-' + crypto.randomUUID() + '.jpg';
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(imagePath, imageBuffer, { contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;
    const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(imagePath).data.publicUrl;
    const caption = 'Can you solve today’s ' + question.subject + ' question? Drop your answer in the comments.\\n\\nFollow Shiney Brain Academy for daily JAMB practice.\\n\\n#ShineyBrainAcademy #JAMB #UTME #JAMB2027 #QuestionOfTheDay';
    const metadata = {
      subject: question.subject, topic: question.topic, difficulty: question.difficulty,
      options: question.options, correctOptionId: question.correctOptionId,
      explanation: question.explanation, image_url: imageUrl, storage_path: imagePath, caption,
      source: body.questionId ? 'past_questions' : 'manual'
    };
    const { data: content, error: contentError } = await supabase.from('content_assets').insert({
      asset_type: 'question_of_the_day', platform: null, format: 'image',
      title: question.subject + ' Question of the Day', body: question.question,
      status: 'draft', generated_by: 'sba-question-of-the-day-renderer', metadata
    }).select().single();
    if (contentError) throw contentError;
    const { error: mediaError } = await supabase.from('media_files').insert({
      content_asset_id: content.id, media_type: 'image', role: 'primary', position: 0,
      url: imageUrl, storage_path: imagePath, width: W, height: H,
      file_size_bytes: imageBuffer.length, mime_type: 'image/jpeg', source: 'render',
      alt_text: question.subject + ' question from Shiney Brain Academy'
    });
    if (mediaError) throw mediaError;
    return NextResponse.json({ success: true, question: { ...question, id: content.id, imageUrl, caption } });
  } catch (error) {
    console.error('Question of the Day render failed:', error);
    return NextResponse.json({ error: error.message || 'Rendering failed.' }, { status: 500 });
  }
}
