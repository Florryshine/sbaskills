import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import {
  fetchStockImage,
  createBrandedThumbnail,
  createFallbackThumbnail,
  IMAGE_PRESETS,
} from '@/lib/image-engine';
import { parseJsonFromText as robustParseJsonFromText } from '@/lib/robustJsonParse';

const AVAILABLE_TOOLS = [
  'JAMB Aggregate Calculator',
  'Cut-off Mark Checker',
  'Past Question Search',
  'Subject Combination Checker',
  'Admission Chance Checker',
  'WAEC Grade Calculator',
  'Study Timetable Generator',
  'Daily Mentor',
  'Shine AI',
];

function parseJsonFromText(text) {
  return robustParseJsonFromText(text, 'object');
}

function isValidResult(r) {
  return (
    r &&
    typeof r.content === 'string' &&
    r.content.trim().length > 0 &&
    typeof r.title === 'string' &&
    r.title.trim().length > 0
  );
}

function sanitizeInternalLinks(links, availableTools, availableBlogTitles) {
  if (!Array.isArray(links)) return [];
  const validSet = new Set([...availableTools, ...availableBlogTitles]);
  return links.filter((link) => typeof link === 'string' && validSet.has(link));
}

// This prompt TRANSFORMS an already-researched knowledge asset into a blog
// post. It does not re-research the topic — everything it needs is already
// in the asset (same pattern as the study-notes/quiz/flashcards engines).
function buildBlogFromAssetPrompt(asset, availableTools, availableBlogTitles) {
  const subTopics = (asset.sub_topics || [])
    .map((s) => `- ${s.title}: ${s.explanation}`)
    .join('\n') || 'none';
  const keyConcepts = (asset.key_concepts || []).join(', ') || 'none listed';
  const definitions = (asset.definitions || [])
    .map((d) => `${d.term}: ${d.definition}`)
    .join('\n') || 'none listed';
  const examples = (asset.examples || []).join('\n') || 'none listed';
  const facts = (asset.facts || []).join('\n') || 'none listed';
  const mistakes = (asset.common_mistakes || []).join('\n') || 'none listed';

  return `You are an expert content writer for Shiney Brain Academy. The research below has ALREADY been gathered — use it as your source material, do not invent facts beyond it, but explain and expand it in your own engaging words.

Topic: "${asset.keyword}"
Subject: ${asset.subject || 'General'}

RESEARCH TO USE:
Summary: ${asset.summary}

Sub-topics:
${subTopics}

Key concepts: ${keyConcepts}

Definitions:
${definitions}

Examples:
${examples}

Facts:
${facts}

Common mistakes:
${mistakes}

Write like a brilliant teacher – conversational, encouraging, practical. Use contractions, questions, short stories, and relatable examples. Avoid robotic/textbook language.

Requirements:
- Length: at least 1200 words (aim for 1500-2000 if possible).
- Heading structure is critical for SEO — this is a strict requirement, not a suggestion:
  - Do NOT put an H1 (a line starting with a single "#") anywhere in the "content" field. The page template already renders one H1 from the "title" field above the content, so a second H1 in the body creates a duplicate-H1 error that hurts SEO. The "content" field must start directly with normal paragraph text or an H2.
  - Use at least 5-8 H2 ("##") section headings that each target a distinct, real search phrase a student would type (e.g. "## What is Photosynthesis?", "## Photosynthesis Equation", not vague labels like "## Overview").
  - Break at least 2-3 of those H2 sections into H3 ("###") subsections wherever the topic has natural sub-parts (definitions, stages, types, worked examples).
  - Bullet lists, a table (if useful), FAQ section (6-10 Q&As), meta description (~155 chars), URL slug.
- SEO Title: 55-70 characters (up to 90 if needed for clarity). Put the primary keyword near the start, include the exam name (JAMB, WAEC, NECO) or university where relevant, include the year 2026 or 2026/2027 when appropriate, and target real search intent. Avoid vague 1-2 word titles.
- Structure:
  1. Introduction (hook the reader – question, myth, surprising fact)
  2. Explain the topic (simple, step-by-step, using the sub-topics above as your section outline)
  3. Common mistakes
  4. Practical tips
  5. 💡 Shine Tip (personal advice)
  6. ❌ Myth vs ✅ Reality (pairs)
  7. Quick summary (table)
  8. FAQ
  9. 🎯 Before You Leave (CTA, link to tools)
- Internal links: reference up to 10 items from the AVAILABLE lists below. Only use exact matches; never invent.

AVAILABLE TOOLS (real platform tools):
${availableTools.map((t) => `- ${t}`).join('\n')}

AVAILABLE EXISTING BLOG POSTS (real published articles, if any):
${availableBlogTitles.length > 0 ? availableBlogTitles.map((t) => `- ${t}`).join('\n') : '(none yet)'}

Return ONLY this JSON object – no markdown fences, no extra text. The "content" field must be the full Markdown article.

{
  "title": "SEO-optimized title, 55-70 chars (up to 90 if needed), keyword-first, includes exam/university name and year where relevant",
  "slug": "url-friendly-slug",
  "meta_description": "~155 chars",
  "content": "Full Markdown article with all required sections",
  "faq": [{"question": "...", "answer": "..."}],
  "internal_links": ["exact tool or blog title", ...],
  "cta": "One-line call-to-action",
  "image_search": "3-5 word stock photo search phrase"
}`;
}

async function uploadImage(supabase, buffer, ext = 'jpg', folder = 'blog-images') {
  const fileName = `hero-${Date.now()}.${ext}`;
  const path = `${folder}/${fileName}`;
  const { error } = await supabase.storage
    .from('blog-images')
    .upload(path, buffer, { contentType: `image/${ext}` });
  if (error) throw error;
  const { data } = supabase.storage.from('blog-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function POST(request) {
  try {
    const { knowledgeAssetId } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    const { data: existingPosts } = await supabase
      .from('content_drafts')
      .select('title')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(150);
    const availableBlogTitles = (existingPosts || []).map((p) => p.title).filter(Boolean);

    const prompt = buildBlogFromAssetPrompt(asset, AVAILABLE_TOOLS, availableBlogTitles);

    const { result, usedProvider, errors } = await generateWithFallback(
      prompt,
      parseJsonFromText,
      isValidResult,
      16000 // was 8192 — a 1500-2000 word article as escaped JSON routinely
            // exceeded that, truncating the JSON mid-string (no closing
            // brace/quote), which made every parse strategy in
            // robustJsonParse.js fail on every provider at once — that's
            // why blog showed "response failed validation" from BOTH
            // Gemini and Groq on the same call instead of a real API error.
    );

    if (!result) {
      return NextResponse.json({ error: `All providers failed: ${errors.join('; ')}` }, { status: 500 });
    }

    const cleanInternalLinks = sanitizeInternalLinks(result.internal_links, AVAILABLE_TOOLS, availableBlogTitles);
    const slug = result.slug || result.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
    const wordCount = result.content?.split(/\s+/).length || 0;

    const { data: draft, error: draftError } = await supabase
      .from('content_drafts')
      .insert({
        knowledge_asset_id: asset.id,
        keyword: asset.keyword,
        title: result.title,
        url_slug: slug,
        meta_description: result.meta_description,
        tags: asset.tags || [],
        content: result.content,
        schemas: JSON.stringify(result.faq || []),
        internal_links: cleanInternalLinks,
        cta: result.cta || '',
        word_count: wordCount,
        category: asset.subject || 'General',
        status: 'draft',
        content_score: 85,
        readability_score: 80,
      })
      .select()
      .single();

    if (draftError) {
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    // Cover image — best-effort. If this fails, the draft still exists and can
    // get an image added manually later, so we don't fail the whole request.
    let coverImageUrl = null;
    let imageError = null;
    try {
      const searchPhrase = result.image_search || result.title;
      const stock = await fetchStockImage(searchPhrase);
      let brandedBuffer;
      let imageMeta = {};

      if (stock) {
        brandedBuffer = await createBrandedThumbnail(stock.buffer, result.title, asset.subject || 'General', IMAGE_PRESETS.hero);
        imageMeta = {
          image_source: 'stock',
          image_provider: stock.provider,
          image_photographer: stock.photographer,
          image_search_query: searchPhrase,
        };
      } else {
        brandedBuffer = await createFallbackThumbnail(result.title, asset.subject || 'General', IMAGE_PRESETS.hero);
        imageMeta = {
          image_source: 'fallback',
          image_provider: 'SBA Brand',
          image_photographer: 'Shiney Brain Academy',
          image_search_query: searchPhrase,
        };
      }

      coverImageUrl = await uploadImage(supabase, brandedBuffer, 'jpg', 'blog-images');

      await supabase
        .from('content_drafts')
        .update({
          cover_image: coverImageUrl,
          image_source: imageMeta.image_source,
          image_provider: imageMeta.image_provider,
          image_photographer: imageMeta.image_photographer,
          image_search_query: imageMeta.image_search_query,
          width: IMAGE_PRESETS.hero.width,
          height: IMAGE_PRESETS.hero.height,
        })
        .eq('id', draft.id);
    } catch (imgErr) {
      console.error('❌ Blog image generation failed:', imgErr);
      imageError = imgErr.message;
    }

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      title: result.title,
      usedProvider,
      coverImage: coverImageUrl,
      imageError,
      internalLinksUsed: cleanInternalLinks,
    });
  } catch (error) {
    console.error('❌ Blog generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}