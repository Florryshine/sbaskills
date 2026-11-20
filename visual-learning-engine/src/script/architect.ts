// src/script/architect.ts — deterministic script builder (no LLM, no keys).
//
// When no LLM keys are configured (or the caller asks for useAI:false) this
// builds a solid, editable educational episode skeleton from the job inputs:
// hook -> title -> alternating statement/compare/list/stat/process scenes
// derived from the caller's key points (or generated place-keepers) -> recap
// -> outro. The admin UI lets users edit the script before rendering, so the
// architect's job is to produce good bones fast, not final prose.

import type { EpisodeScript, VLJobSpec } from '../types';

function words(narration: string): number {
  return narration.trim().split(/\s+/).filter(Boolean).length;
}

function titleCase(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/(^|[\s\-–—])([a-z])/g, (m) => m.toUpperCase());
}

/** Extracts 2-4 punchy headline words from a key point (max ~5 words). */
function headlineFrom(text: string, maxWords = 5): string {
  const cleaned = text.replace(/[.!?;:]+$/, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length <= maxWords) return titleCase(cleaned);
  return titleCase(parts.slice(0, maxWords).join(' ')) + '…';
}

function pickAccentWord(headline: string): string | undefined {
  const candidates = headline
    .split(/\s+/)
    .filter((w) => w.replace(/[^A-Za-z0-9]/g, '').length > 3);
  if (candidates.length === 0) return undefined;
  // Prefer the last long word — the punch word — as the accent.
  return candidates[candidates.length - 1].replace(/[^A-Za-z0-9'’-]/g, '');
}

export function architectScript(job: VLJobSpec): EpisodeScript {
  const topic = job.topic.replace(/\s+/g, ' ').trim() || 'this topic';
  const audience = job.audience.replace(/\s+/g, ' ').trim() || 'students';
  const seedPoints = [
    `The core idea of ${topic}`,
    `Why ${topic} matters for ${audience}`,
    `How to apply ${topic} today`,
  ];
  const keyPoints = (job as VLJobSpec & { keyPoints?: string[] }).keyPoints?.filter((p) => typeof p === 'string' && p.trim().length > 2).slice(0, 6) ?? [];
  const points = (keyPoints.length >= 2 ? keyPoints : seedPoints).map((p) => p.trim());

  // Budget: one body scene per ~35-45s of narration beyond hook/outro.
  const bodySeconds = Math.max(10, job.targetSeconds - 14 - 12);
  const bodySceneCount = Math.max(2, Math.min(8, Math.round(bodySeconds / 38)));
  const bodyPoints = points.slice(0, Math.max(2, Math.min(8, bodySceneCount)));

  const scenes: EpisodeScript['scenes'] = [];
  scenes.push({
    type: 'hook',
    headline: `WHY ${titleCase(topic).toUpperCase()}?`,
    accentWord: pickAccentWord(`WHY ${titleCase(topic).toUpperCase()}`)?.toUpperCase(),
    image_prompt: `a curious ${audience === 'students' ? 'student' : 'person'} surrounded by floating question marks and lightbulbs, thinking hard about ${topic}`,
    narration: `Have you ever wondered how ${topic} actually works — and why some people seem to master it effortlessly? In the next few minutes, you'll see the whole picture, step by step, in a way that finally sticks.`,
  });

  scenes.push({
    type: 'title',
    headline: titleCase(job.title || topic).toUpperCase(),
    subtitle: `A visual guide for ${audience}`,
    image_prompt: `hero illustration of ${topic}: a central figure or object with clearly readable visual metaphors around it`,
    narration: `Welcome to ${titleCase(job.title || topic)}. Let's break it down visually, one idea at a time.`,
  });

  bodyPoints.forEach((point, i) => {
    const kind = i % 4;
    if (kind === 0) {
      scenes.push({
        type: 'statement',
        headline: headlineFrom(point),
        accentWord: pickAccentWord(point),
        image_prompt: `illustration showing ${point} — simple visual metaphor related to ${topic}`,
        badges: [{ label: 'Key idea', emoji: '💡' }, { label: `${topic.slice(0, 24)}`, emoji: '🎯' }],
        narration: `Here's the first thing to understand: ${point}. Most people skip this part, but it's the foundation everything else builds on. Keep it in mind as we go.`,
      });
    } else if (kind === 1) {
      scenes.push({
        type: 'compare',
        versus: 'VS',
        left: {
          label: 'WITHOUT IT',
          tone: 'bad',
          image_prompt: `a frustrated person struggling with ${topic}, messy papers, tangled lines above their head`,
        },
        right: {
          label: 'WITH IT',
          tone: 'good',
          image_prompt: `a confident person succeeding at ${topic}, clean organized notes, lightbulb above their head`,
        },
        narration: `So what changes in practice? Without this principle, ${topic} feels slow and frustrating. With it, the same work becomes clearer and faster. Notice how different the two pictures look.`,
      });
    } else if (kind === 2) {
      scenes.push({
        type: 'stat',
        number: '10x',
        headline: headlineFrom(point),
        image_prompt: `a simple bar chart or growth arrow visualising improvement in ${topic}`,
        narration: `And the payoff is real. Learners who apply this principle consistently see progress that compounds over time — small daily gains turning into a dramatic difference.`,
      });
    } else {
      scenes.push({
        type: 'process',
        title: 'HOW TO DO IT',
        steps: [
          { text: 'Start small', emoji: '🌱' },
          { text: 'Practice daily', emoji: '🔁' },
          { text: 'Get feedback', emoji: '🔍' },
        ],
        narration: `Here's the practical method. Start with one small piece you can do today. Repeat it until it feels easy. Then check your results and adjust. That loop is the whole secret.`,
      });
    }
  });

  scenes.push({
    type: 'recap',
    title: 'REMEMBER THIS',
    items: points.slice(0, 3).map((p) => headlineFrom(p, 8).replace(/…$/, '')),
    narration: `Let's pull it together. ${points.slice(0, 3).map((p) => p.replace(/[.!?]+$/, '')).join('. ')}. If you remember only these, you're already ahead.`,
  });

  scenes.push({
    type: 'outro',
    headline: titleCase(job.title || topic).toUpperCase(),
    cta: 'Subscribe for more visual learning.',
    narration: `That's the whole picture of ${topic}, made simple. If this helped, follow along for the next one — and keep turning curiosity into skill.`,
  });

  // Rough length re-balance: if we overshot the target badly, trim body scenes
  // (the narration text stays; actual durations come from measured audio).
  const estimatedWords = scenes.reduce((acc, s) => acc + words(s.narration), 0);
  const targetWords = (job.targetSeconds / 60) * 150;
  while (estimatedWords > targetWords * 1.25 && scenes.length > 5) {
    const idx = scenes.findIndex((s) => s.type === 'statement' || s.type === 'stat' || s.type === 'process' || s.type === 'compare');
    if (idx < 0) break;
    scenes.splice(idx, 1);
  }

  return {
    meta: {
      title: titleCase(job.title || topic),
      hookHeadline: `WHY ${titleCase(topic).toUpperCase()}?`,
      subtitle: `A visual guide for ${audience}`,
      style: job.style,
      accent: job.accent || '#E63946',
    },
    scenes,
  };
}
