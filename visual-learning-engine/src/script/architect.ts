// Deterministic fallback for Visual Learning.
// This is deliberately conservative: without an actual lesson brief it refuses
// to invent a lesson, rather than publishing motivational filler as education.
import type { EpisodeScript, VLJobSpec } from '../types';

function titleCase(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/(^|[\s\-–—])([a-z])/g, (m) => m.toUpperCase());
}
function headlineFrom(text: string, maxWords = 6): string {
  const cleaned = text.replace(/[.!?;:]+$/, '').trim();
  const parts = cleaned.split(/\s+/);
  return titleCase(parts.length <= maxWords ? cleaned : parts.slice(0, maxWords).join(' ') + '…');
}
function pickAccentWord(headline: string): string | undefined {
  const words = headline.split(/\s+/).filter((w) => w.replace(/[^A-Za-z0-9]/g, '').length > 3);
  return words.length ? words[words.length - 1].replace(/[^A-Za-z0-9'’-]/g, '') : undefined;
}
export function architectScript(job: VLJobSpec): EpisodeScript {
  const topic = job.topic.replace(/\s+/g, ' ').trim() || 'this topic';
  const audience = job.audience.replace(/\s+/g, ' ').trim() || 'students';
  const brief = (job as VLJobSpec & { keyPoints?: string[] }).keyPoints
    ?.filter((p) => typeof p === 'string' && p.trim().length > 8)
    .map((p) => p.trim()).slice(0, 8) ?? [];
  if (brief.length < 2) {
    throw new Error(`Cannot safely create a teaching episode about "${topic}" without lesson content. Add at least two specific, verified key points (definitions, mechanisms, examples or facts), then retry. The fallback will not invent facts or substitute generic motivation for teaching.`);
  }

  const scenes: EpisodeScript['scenes'] = [
    {
      type: 'hook',
      headline: `HOW DOES ${titleCase(topic).toUpperCase()} WORK?`,
      accentWord: pickAccentWord(topic.toUpperCase()),
      image_prompt: `accurate educational illustration directly depicting ${topic}, with the central subject and its real components`,
      narration: `Imagine encountering ${topic} for the first time. What exactly should you understand, and how do the important ideas fit together? By the end, you should be able to explain the key points clearly.`,
    },
    {
      type: 'title',
      headline: titleCase(job.title || topic).toUpperCase(),
      subtitle: `Learn the key ideas about ${topic}`,
      image_prompt: `clear subject-specific educational overview of ${topic}, accurate central subject and relevant parts`,
      narration: `Welcome. We will work through the supplied lesson points in order, explain what each one means, and connect them to the topic.`,
    },
  ];

  brief.forEach((point, i) => {
    scenes.push({
      type: 'statement',
      headline: headlineFrom(point),
      accentWord: pickAccentWord(headlineFrom(point)),
      image_prompt: `accurate educational visual explaining this specific lesson point: ${point}. Show only relevant subject matter and correct relationships; no generic student characters or decorative metaphors.`,
      badges: [{ label: `Concept ${i + 1}`, emoji: '🔎' }],
      narration: `Here is an important point: ${point}. Read that idea carefully and connect it to ${topic}. The key is to understand what this statement tells you, rather than memorising the words alone.`,
    });
  });

  const recapItems = brief.slice(0, 4).map((p) => headlineFrom(p, 8).replace(/…$/, ''));
  scenes.push({
    type: 'recap',
    title: 'CHECK YOUR UNDERSTANDING',
    items: recapItems.length >= 2 ? recapItems : [headlineFrom(brief[0]), headlineFrom(brief[1])],
    narration: `Before you finish, try to explain each of these ideas in your own words. What does each point mean, and how does it connect to ${topic}? If you cannot explain one yet, revisit that part of the lesson.`,
  });
  scenes.push({
    type: 'outro',
    headline: titleCase(job.title || topic).toUpperCase(),
    cta: 'Review the key ideas and test your understanding.',
    narration: `That is the lesson outline for ${topic}. Your next step is to explain the key ideas without looking at the screen, then apply them to a new example.`,
  });

  return {
    meta: {
      title: titleCase(job.title || topic),
      hookHeadline: `HOW DOES ${titleCase(topic).toUpperCase()} WORK?`,
      subtitle: `Learn the key ideas about ${topic}`,
      style: job.style,
      accent: job.accent || '#E63946',
    },
    scenes,
  };
}
