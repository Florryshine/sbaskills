/**
 * Dialogue → facial emotion reactions.
 *
 * Given a character's dialogue line and a baseline emotion, returns a small
 * schedule of FaceEvents that overlay short emotional reactions mid-line.
 * This is the "responds to what's being said" layer — the base emotion is
 * whatever the script set, but a sentence starting with "Wow!" or ending
 * with "?" nudges the face to surprised or confused for a beat.
 *
 * Phase A: keyword-based heuristic, fast and deterministic. Phase B will
 * upgrade to phoneme timing + sentiment if needed.
 */
import { Emotion, FaceEvent } from '../rig/character';

interface Rule {
  pattern: RegExp;
  emo: Emotion;
  /** Delay in frames from line start before the reaction fires. */
  delay: number;
  /** How many frames the reaction lasts before returning to base. */
  hold: number;
}

// Order matters — earlier rules take priority for the "first reaction".
const RULES: Rule[] = [
  // Surprise / positive exclamation
  { pattern: /^\s*(wow|whoa|amazing|incredible|unbelievable|omg)\b/i, emo: 'surprised', delay: 0, hold: 10 },
  { pattern: /\b(wow|whoa|amazing|incredible|unbelievable)\b/i, emo: 'surprised', delay: 6, hold: 10 },
  // Happy / laughter
  { pattern: /\b(haha|lol|hehe|yay|great|awesome|fantastic|nice|excellent)\b/i, emo: 'happy', delay: 4, hold: 12 },
  // Question / confusion
  { pattern: /\?\s*$/, emo: 'confused', delay: 8, hold: 12 },
  { pattern: /\b(what|huh|why|how come|really|wait)\b/i, emo: 'confused', delay: 4, hold: 10 },
  // Sadness / apology
  { pattern: /\b(sorry|unfortunately|sadly|miss|missed|lost|failed|alone)\b/i, emo: 'sad', delay: 4, hold: 12 },
  // Anger / refusal
  { pattern: /\b(no!|never|stop|wrong|refuse|angry|furious)\b/i, emo: 'angry', delay: 2, hold: 10 },
  // Fear / worry
  { pattern: /\b(oh no|scared|afraid|danger|help!|emergency)\b/i, emo: 'fear', delay: 0, hold: 12 },
  { pattern: /\b(worried|concerned|nervous|anxious)\b/i, emo: 'worried', delay: 6, hold: 10 },
  // Emphasis / point
  { pattern: /\b(remember|note|important|key|crucial|must)\b/i, emo: 'focused', delay: 6, hold: 12 },
  // Trailing ellipsis = thinking
  { pattern: /\.\.\.\s*$/, emo: 'confused', delay: 10, hold: 14 },
];

/**
 * Compute face events for one dialogue line.
 *
 * @param text       the dialogue line text
 * @param baseEmo    the emotion the character has been showing (baseline)
 * @param startFrame timeline frame where the line begins
 * @param durFrames  how many frames the line lasts
 * @param fps        frames per second
 * @returns ordered FaceEvents: any mid-line reactions followed by a return to baseEmo
 */
export function reactionsForDialogue(
  text: string,
  baseEmo: Emotion,
  startFrame: number,
  durFrames: number,
  fps: number,
): FaceEvent[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  // Longer lines get more of a chance to react.
  if (durFrames < 0.4 * fps) return [];

  const events: FaceEvent[] = [];
  const used = new Set<Rule>();

  for (const rule of RULES) {
    if (used.has(rule)) continue;
    if (!rule.pattern.test(trimmed)) continue;
    if (rule.emo === baseEmo) continue; // no-op reaction

    const reactFrame = startFrame + Math.min(rule.delay, durFrames - 2);
    if (reactFrame >= startFrame + durFrames - 1) continue;

    events.push({ frame: reactFrame, emo: rule.emo });

    // Schedule a return to base if there's room.
    const returnFrame = reactFrame + rule.hold;
    if (returnFrame < startFrame + durFrames) {
      events.push({ frame: returnFrame, emo: baseEmo });
    }
    used.add(rule);

    // Only one mid-line reaction per dialogue line — keeps it readable.
    break;
  }

  return events;
}
