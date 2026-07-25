// lib/content-factory/generators/founder.js
//
// Founder Post — a persona prompt, not a new engine. Reuses the exact
// generate → insert → attach-media pipeline every other generator uses;
// the only difference is voice (first-person, as Florry) instead of
// brand voice, and two optional inputs the admin can set at generate time:
// `voiceMode` (founder/mentor/funny/reflective) and `founderContext`
// (a free-text "what's on my mind today" note, usually empty).
//
// The one hard rule that survived the design discussion: never manufacture
// a personal story or inspiration that isn't grounded in the topic or the
// context note. A flat, observational post beats a fake "here's my
// journey" post. That instruction is baked into the prompt below and is
// not something the UI can override.
import { buildAssetContext, generateJson } from './_shared';

const VOICE_MODES = {
  founder: {
    label: 'Founder',
    description:
      'Voice: confident, direct, a little bold — someone who built this from nothing and is speaking about where education in Nigeria is failing students and what Shiney Brain Academy is doing differently. First person singular ("I built this because...", "I keep seeing...").',
    styleNotes:
      'Lead with a real observation or conviction, not a slogan. It is fine to be opinionated about exam prep, the school system, or how students are taught to think. No hashtags, no "link in bio", no corporate CTA — this is a person talking, not an ad.',
  },
  mentor: {
    label: 'Mentor',
    description:
      'Voice: warm, patient, encouraging — the tone of someone who has personally tutored thousands of JAMB/WAEC students and knows exactly where they get stuck. First person singular, speaking directly to one student as if writing them a note.',
    styleNotes:
      'Focus on reassurance grounded in specifics — name the exact fear or mistake students have about this topic, then address it plainly. Avoid generic motivational language ("you can do anything!"). Speak like someone who has actually watched a student struggle with this exact concept.',
  },
  funny: {
    label: 'Funny Florry',
    description:
      'Voice: light, self-aware, a little cheeky — the founder poking fun at herself, at exam stress culture, or at how ridiculous some part of the syllabus is, while still being useful. First person singular.',
    styleNotes:
      'Humor has to come from something true and specific (a real quirk of the topic, a real thing students do), never a manufactured joke or meme reference bolted on. If nothing about this topic is genuinely funny, undersell it rather than force a laugh — a dry, honest observation is better than a forced joke.',
  },
  reflective: {
    label: 'Reflective',
    description:
      'Voice: slower, thoughtful, willing to admit uncertainty or a mistake — the founder thinking out loud about learning, teaching, or building the platform. First person singular.',
    styleNotes:
      'This is the mode most likely to reference the founder-context note if one is given. Without one, reflect honestly on what this specific topic reveals about how students learn or how exams are designed — not a forced personal anecdote. Vulnerability has to be earned by specificity, not performed.',
  },
};

// Same persona post goes out as three platform-shaped rows so it fits the
// existing review/approve/publish flow and each row gets correct char-limit
// validation (see PLATFORM_LIMITS in _shared.js and the PATCH route).
const TARGETS = [
  { platform: 'linkedin', asset_type: 'founder_linkedin' },
  { platform: 'facebook', asset_type: 'founder_facebook' },
  { platform: 'instagram', asset_type: 'founder_instagram' },
];

export async function generateFounderPost(asset, options = {}) {
  const { voiceMode = 'founder', founderContext = '' } = options;
  const voice = VOICE_MODES[voiceMode] || VOICE_MODES.founder;
  const context = buildAssetContext(asset);
  const trimmedContext = (founderContext || '').trim();

  const contextBlock = trimmedContext
    ? `\n\nSomething on the founder's mind today — weave it in naturally ONLY if it genuinely fits this topic, otherwise ignore it rather than forcing a connection: "${trimmedContext}"`
    : '';

  const prompt = `You are writing as Florry, the founder of Shiney Brain Academy, posting in first person directly to students and parents — a real person, not the brand account.

${voice.description}

${context}${contextBlock}

CRITICAL RULE: Never manufacture a personal story, struggle, or inspiration that isn't grounded in the topic above or the founder's note above. If there is nothing personal to say today, write from genuine observation about the topic instead — a real pattern you've noticed in how students misunderstand or struggle with it. A flat, honest, observational post is always better than a fake "here's my journey" post.

${voice.styleNotes}

Write ONE post, 80-180 words, plain first-person language. No corporate phrases ("Discover how...", "Unlock your potential..."), no excessive emoji, no more than one hashtag if any.

Return ONLY JSON:
{ "caption": "..." }`;

  const data = await generateJson(prompt, { expect: 'object' });

  return TARGETS.map(({ platform, asset_type }) => ({
    asset_type,
    platform,
    format: 'image',
    title: `Founder Post — ${voice.label} — ${asset.keyword}`,
    body: data.caption,
    metadata: { voiceMode, founderContext: trimmedContext || null },
    // hero image only — no carousel for founder posts, this is a persona
    // moment, not a lesson breakdown.
    _media: {
      type: 'hero_image',
      searchQuery: [asset.subject, asset.keyword].filter(Boolean).join(' '),
      category: asset.subject,
      preset: 'hero',
    },
  }));
}

export { VOICE_MODES };
