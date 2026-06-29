import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load knowledge base
const knowledgeBase = {
  brand: `Shiney Brain Academy – bright blue (#1a73e8), gold (#FFCC00), white. Bold, Africa-proud, modern.`,
  tone: `Conversational, Nigerian student-friendly, mentor-like. Use "you", be encouraging, practical.`,
  tools: [
    'JAMB Aggregate Calculator',
    'WAEC Grade Calculator',
    'Subject Combination Checker',
    'Admission Chance Checker',
    'Cut-off Mark Checker',
    'Past Question Search',
    'Study Timetable Generator',
    'Daily Mentor',
    'Shine AI (AI Tutor)',
    'Daily Challenge',
    'Boss Battles',
    'Achievements',
    'Library (Books)',
    'Video Lessons',
    'Certificates'
  ]
};

export async function POST(request) {
  try {
    const { queueItemId } = await request.json();
    const supabase = createRouteHandlerClient();

    // Get queue item
    const { data: item } = await supabase
      .from('content_queue')
      .select('*')
      .eq('id', queueItemId)
      .single();

    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    // Check if draft already exists
    if (item.draft_id) {
      const { data: existing } = await supabase
        .from('content_drafts')
        .select('id')
        .eq('id', item.draft_id)
        .single();
      if (existing) {
        return NextResponse.json({ error: 'Draft already exists' }, { status: 409 });
      }
    }

    // Update status to generating
    await supabase
      .from('content_queue')
      .update({ status: 'generating' })
      .eq('id', queueItemId);

    // Generate content with Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an expert content writer for Shiney Brain Academy (SBA), Nigeria's leading exam prep and skills platform.

    Write a complete, SEO-optimized blog article on the topic: "${item.keyword}"

    Category: ${item.category || 'General'}
    Priority: ${item.priority || 'Medium'}

    Knowledge Base:
    - Brand: ${knowledgeBase.brand}
    - Tone: ${knowledgeBase.tone}
    - Available Tools: ${knowledgeBase.tools.join(', ')}

    Requirements:
    1. Title: Engaging, keyword-rich (max 60 chars)
    2. Meta Description: Compelling, includes keyword (max 160 chars)
    3. Slug: URL-friendly version of the title
    4. Tags: 3-5 relevant tags
    5. Content: 1500-2500 words, well-structured with H2, H3 headings
    6. Internal Links: Reference at least 3 SBA tools naturally
    7. FAQ Section: 3-5 questions with answers
    8. CTA: End with a "Before You Leave" section linking to relevant SBA tools
    9. Image Suggestions: 3 image descriptions (hero, infographic, social card)

    Return the response as a valid JSON object with this exact structure:
    {
      "title": "...",
      "slug": "...",
      "meta_description": "...",
      "tags": ["tag1", "tag2"],
      "content": "...",
      "faq": [{"question": "...", "answer": "..."}],
      "internal_links": ["tool1", "tool2"],
      "images": [
        {"type": "hero", "description": "..."},
        {"type": "infographic", "description": "..."},
        {"type": "social", "description": "..."}
      ],
      "cta": "..."
    }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON from response
    let data;
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      data = JSON.parse(cleaned);
    } catch (e) {
      // Fallback: try to extract JSON
      const match = text.match(/\{[\s\S]*\}/);
      if (match) data = JSON.parse(match[0]);
      else throw new Error('Failed to parse AI response');
    }

    // Save draft to database
    const { data: draft, error: draftError } = await supabase
      .from('content_drafts')
      .insert({
        queue_id: queueItemId,
        keyword: item.keyword,
        title: data.title,
        slug: data.slug,
        meta_description: data.meta_description,
        tags: data.tags || [],
        content: data.content,
        faq: data.faq || [],
        internal_links: data.internal_links || [],
        images: data.images || [],
        cta: data.cta || '',
        word_count: data.content?.split(/\s+/).length || 0,
        category: item.category,
        status: 'draft',
        content_score: 85, // placeholder, will be improved later
        readability_score: 80,
      })
      .select()
      .single();

    if (draftError) {
      await supabase
        .from('content_queue')
        .update({ status: 'failed' })
        .eq('id', queueItemId);
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    // Update queue item
    await supabase
      .from('content_queue')
      .update({
        status: 'draft',
        draft_id: draft.id,
        generated_at: new Date().toISOString(),
      })
      .eq('id', queueItemId);

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      title: data.title,
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}