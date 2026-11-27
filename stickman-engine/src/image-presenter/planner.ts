import type { ImagePresenterAspectRatio, ImagePresenterMode, PresenterGesture, PresenterPosition } from './types';

export interface ImagePresenterPlannerInput {
  topic: string;
  script?: string;
  mode?: ImagePresenterMode | 'auto';
  aspectRatio?: ImagePresenterAspectRatio;
  presenterId?: string;
  maxScenes?: number;
}
export interface PlannedImageNeed {
  id: string; subject: string; searchQuery: string;
  role: 'main' | 'left' | 'right' | 'step' | 'diagram';
  distinctFrom?: string;
}
export interface PlannedPresenterCue {
  gesture: PresenterGesture; position: PresenterPosition;
  target?: { x: number; y: number };
}
export interface PlannedImagePresenterScene {
  id: string; type: ImagePresenterMode; title: string; narration: string; caption: string;
  imageNeeds: PlannedImageNeed[]; presenter: PlannedPresenterCue;
  layout: 'hero' | 'split' | 'sequence' | 'annotated'; rationale: string[];
}
export interface ImagePresenterScenePlan {
  version: 1; title: string; subject: string; mode: ImagePresenterMode;
  aspectRatio: ImagePresenterAspectRatio; presenterId: string;
  scenes: PlannedImagePresenterScene[]; warnings: string[];
}
const MODES: ImagePresenterMode[] = ['single-image', 'two-image-comparison', 'multi-image-sequence', 'diagram-explanation'];
function clean(value: string): string {
  return value.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim();
}
function splitBeats(script: string): string[] {
  const lines = script.replace(/\r/g, '').split(/\n+/).map(clean).filter(Boolean);
  if (lines.length > 1) return lines;
  return (lines[0] ?? '').match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()).filter(Boolean) ?? [];
}
function inferMode(input: ImagePresenterPlannerInput, text: string): ImagePresenterMode {
  if (input.mode && input.mode !== 'auto') return input.mode;
  const lower = text.toLowerCase();
  if (/\b(vs\.?|versus|compare|comparison|difference between|distinguish)\b/.test(lower)) return 'two-image-comparison';
  if (/\b(diagram|labelled|labeled|anatomy|parts of|structure of|cross[- ]section)\b/.test(lower)) return 'diagram-explanation';
  if (/\b(step[- ]by[- ]step|process|stages|sequence|how to|life cycle|water cycle)\b/.test(lower)) return 'multi-image-sequence';
  return 'single-image';
}
function titleCase(value: string): string { return value.replace(/\b\w/g, c => c.toUpperCase()); }
function comparisonSubjects(text: string, topic: string): [string, string] {
  const match = text.match(/(.+?)\s+(?:vs\.?|versus|compared with|compared to)\s+(.+?)(?:[.!?:,]|$)/i)
    ?? topic.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:[.!?:,]|$)/i);
  if (match) return [clean(match[1]), clean(match[2])];
  const between = text.match(/difference between\s+(.+?)\s+and\s+(.+?)(?:[.!?:,]|$)/i);
  if (between) return [clean(between[1]), clean(between[2])];
  return [topic + ' first example', topic + ' contrasting example'];
}
function makeScene(mode: ImagePresenterMode, index: number, narration: string, topic: string, sequenceParts: string[] = []): PlannedImagePresenterScene {
  const id = 'image-scene-' + String(index + 1).padStart(3, '0');
  const title = titleCase((narration.split(/[.!?:]/)[0] || topic).slice(0, 64));
  let imageNeeds: PlannedImageNeed[] = [];
  let layout: PlannedImagePresenterScene['layout'] = 'hero';
  let gesture: PresenterGesture = 'explain';
  const position: PresenterPosition = 'bottom-right';
  const rationale: string[] = [];
  if (mode === 'two-image-comparison') {
    const [left, right] = comparisonSubjects(narration, topic);
    imageNeeds = [
      { id: id + '-left', subject: left, searchQuery: left, role: 'left', distinctFrom: id + '-right' },
      { id: id + '-right', subject: right, searchQuery: right, role: 'right', distinctFrom: id + '-left' },
    ];
    layout = 'split'; gesture = 'point-left';
    rationale.push('Comparison intent detected; retrieve left and right assets independently.', 'Use a split layout with persistent labels.');
  } else if (mode === 'multi-image-sequence') {
    const parts = sequenceParts.length ? sequenceParts : splitBeats(narration);
    imageNeeds = (parts.length > 1 ? parts : [narration]).slice(0, 8).map((part, step) => ({
      id: id + '-step-' + (step + 1), subject: part.slice(0, 100), searchQuery: part.slice(0, 100), role: 'step',
    }));
    layout = 'sequence'; gesture = 'point-right';
    rationale.push('Ordered process/sequence intent detected; preserve supplied beat order.');
  } else if (mode === 'diagram-explanation') {
    imageNeeds = [{ id: id + '-diagram', subject: topic, searchQuery: topic + ' labelled educational diagram', role: 'diagram' }];
    layout = 'annotated'; gesture = 'point-up';
    rationale.push('Diagram intent detected; acquire one clear diagram and add editable annotations later.');
  } else {
    imageNeeds = [{ id: id + '-main', subject: topic, searchQuery: topic, role: 'main' }];
    rationale.push('Single visual focus selected; keep image dominant and presenter secondary.');
  }
  if (/\b(why|cause|because|reason)\b/i.test(narration)) gesture = 'think';
  if (/\b(important|remember|warning|danger)\b/i.test(narration)) gesture = 'point-up';
  return { id, type: mode, title, narration, caption: narration, imageNeeds, presenter: { gesture, position }, layout, rationale };
}
/** Pure deterministic planner: no model calls, provider calls, or fabricated media URLs. */
export function planImagePresenter(input: ImagePresenterPlannerInput): ImagePresenterScenePlan {
  const topic = clean(input.topic || '');
  if (!topic) throw new Error('A topic is required to plan an Image Presenter video.');
  const script = (input.script ?? '').trim();
  const mode = inferMode(input, topic + '\n' + script);
  const rawBeats = splitBeats(script);
  const maxScenes = Math.max(1, Math.min(12, Math.floor(input.maxScenes ?? 6)));
  const beats = mode === 'multi-image-sequence'\n    ? [rawBeats.length ? rawBeats.join(' ') : topic]\n    : (rawBeats.length ? rawBeats : [topic]).slice(0, maxScenes);
  const warnings: string[] = [];
  if (mode === 'two-image-comparison' && !/\b(vs\.?|versus|compared with|compared to|difference between)\b/i.test(topic + ' ' + script))
    warnings.push('Comparison mode selected, but two explicit subjects were not found. Review both image subjects before retrieval.');
  if (mode === 'multi-image-sequence' && beats.length === 1)
    warnings.push('Only one script beat was supplied. Add numbered steps or separate lines for a meaningful sequence.');
  if (mode === 'diagram-explanation' && !/\b(diagram|labelled|labeled|anatomy|parts of|structure of|cross[- ]section)\b/i.test(topic + ' ' + script))
    warnings.push('Diagram mode selected without a clear diagram keyword. Confirm the intended source diagram.');
  if (rawBeats.length > maxScenes) warnings.push('Script was capped at ' + maxScenes + ' scenes; remaining beats were omitted.');
  return {
    version: 1, title: topic, subject: topic, mode,
    aspectRatio: input.aspectRatio ?? '9:16', presenterId: input.presenterId ?? 'prof',
    scenes: beats.map((beat, index) => makeScene(mode, index, beat, topic, mode === 'multi-image-sequence' ? rawBeats.slice(0, 8) : [])), warnings,
  };
}
export function isImagePresenterMode(value: unknown): value is ImagePresenterMode {
  return typeof value === 'string' && MODES.includes(value as ImagePresenterMode);
}
