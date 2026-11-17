// src/script/planner-prompt.ts — LLM lesson planner for the admin Whiteboard Studio.
//
// The prompt turns a topic + subject into the same DSL the deterministic
// parser accepts, so the AI path and the paste-script path share one schema.
//
// The COMPLETE asset catalog (native + legacy, grouped, with descriptions) is
// interpolated below — the model can only choose assets it can see. A
// topic-keyword shortlist is injected as RECOMMENDED so the planner prefers
// precise, on-topic drawings (e.g. the skeleton for a skeletal-system lesson)
// instead of whichever generic icons it happens to remember.

import type { Subject } from '../types';
import { listIllustrationIds, suggestIllustrations } from '../illustrations/registry';
import { LEGACY_ASSETS } from '../illustrations/legacy-catalog';

const SUBJECT_RULES: Record<Subject, string> = {
  biology:
    'Use biology.* and anatomy.* illustrations. biology.* covers plants and cells; anatomy.* covers the human body (skeleton, skull, ribcage, spine, pelvis, femur, knee-joint, muscle-arm, heart, lungs, brain, stomach, neuron, eye-anatomy). For human-body topics ALWAYS draw the actual structure: skeleton for the skeletal system, heart for circulation, lungs for breathing. Build systems part by part, then whole.',
  chemistry:
    'Use chemistry.* illustrations (proton, neutron, electron, nucleus, atom, bohr-* shells, h2o, co2-molecule, ch4, beaker, test-tube, flame, flask). Build structure from particles upward, and always show equations term by term.',
  physics:
    'Use physics.* illustrations (crate, block-table, ball-rolling, ice-puck, pendulum, spring-block, cradle, car, car-braking, inclined-plane, rocket). Always add force/motion arrows with from:/to: coordinates near the object.',
  mathematics:
    'Use math.* illustrations (axes, parabola, bar-chart, pi, right-triangle, circle, grid, graph-line, fraction). Build equations progressively and label every part.',
  general:
    'Any illustration set fits. Prefer general.* icons (lightbulb, book, brain, check, question, star, target, clock) AND general.human characters: teacher, student-raising-hand, student-desk, person-walking, person-running, person-thinking, person-waving, person-reading, person-drinking, people-talking, doctor, face-happy, face-thinking, face-surprised, hand-pointing.',
};

/** Native ids grouped by prefix for the catalog block. */
function nativeCatalogLines(): string[] {
  const groups = new Map<string, string[]>();
  for (const id of listIllustrationIds()) {
    const prefix = id.split('.')[0] ?? 'general';
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(id.replace(`${prefix}.`, ''));
  }
  const lines: string[] = [];
  for (const [prefix, rest] of [...groups.entries()].sort()) {
    lines.push(`  - ${prefix}.*: ${rest.join(', ')}`);
  }
  return lines;
}

/** Legacy SBA assets grouped by category, with their human names. */
function legacyCatalogLines(): string[] {
  const groups = new Map<string, string[]>();
  for (const asset of LEGACY_ASSETS) {
    if (!groups.has(asset.category)) groups.set(asset.category, []);
    groups.get(asset.category)!.push(`${asset.id} (${asset.name})`);
  }
  const lines: string[] = [];
  for (const [category, assets] of [...groups.entries()].sort()) {
    lines.push(`  - legacy.${category}: ${assets.join(', ')}`);
  }
  return lines;
}

function keywordsFromTopic(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

export function buildPlannerPrompt(topic: string, subject: Subject): string {
  const recommended = suggestIllustrations(subject, keywordsFromTopic(topic));
  const recommendedBlock = recommended.length
    ? `RECOMMENDED FOR THIS TOPIC (highest-priority local assets):\n${recommended
        .map((id) => `  - ${id}`)
        .join('\n')}\nUse these wherever they fit before considering anything else.`
    : '';

  return `You are the senior visual lesson director for Shiney Brain Academy. Write a complete, visually rich lesson in the engine's DSL so it can be rendered as a narrated whiteboard animation where a teacher writes and draws while speaking. Every visual must directly support a spoken teaching point.

TOPIC: ${topic}
SUBJECT: ${subject}

COMPLETE ASSET CATALOG — you may ONLY use draw: ids from this list:
${nativeCatalogLines().join('\n')}
${legacyCatalogLines().join('\n')}

${recommendedBlock}

RULES
- Output ONLY the DSL text, no markdown fences, no commentary.
- 4 to 6 scenes. First scene layout "title", last scene layout "summary".
- Middle scenes use "concept", "diagram", "list" or "equation" layouts.
- Every scene MUST have one "narration:" line of 20-40 words of warm, teacherly Nigerian-English narration. Plain sentences, no stage directions, no emojis.
- Every element must be synced to narration with sync:<phrase> where <phrase> is a SHORT EXACT substring of that scene's narration (1-3 words, e.g. sync:skull, sync:ribcage). The sync phrase becomes the written LABEL under the diagram, so pick the name a student should learn (sync:knee joint → "Knee joint" written under the drawing).
- SIZE HIERARCHY: scale: values are relative weights, not percentages. Use scale:0.8 for the hero diagram of a scene (fills the board), scale:0.65 for supporting diagrams, scale:0.45 for small props and characters. The hero visual of every scene must dominate the board.
- HARD VISUAL MINIMUM: EVERY scene, including title and summary, MUST contain at least THREE distinct drawable visual assets. Use at least three separate draw: and/or image: directives per scene. These must be meaningful, different visuals that teach or reinforce the scene — not three copies of the same icon. Never count headings, bullets, equations, arrows or highlights toward the minimum.
- Never invent illustration ids. Never write "draw: text". Words and drawings are separate.
- VISUAL STORYTELLING: visuals must follow the narration like a story — open with a hook (a character or striking object), build the concept piece by piece as it is narrated, then recap. Open the lesson with a person (general.teacher, general.student-raising-hand, general.person-thinking, general.doctor...) or a subject object; put a reacting character (a face or person) in the middle of the lesson; end scenes may use general.check, general.star or general.trophy on a summary. People make the lesson alive: use general.* human characters whenever someone is learning, asking, demonstrating or reacting.
- SCIENTIFIC ACCURACY: for anatomy and biology structures use anatomy.* (skeleton, heart, lungs, brain...) — never a placeholder icon. Structures must be complete: if the narration names a part (skull, ribs, spine, joints...), draw that part. Never show a particle/atom for a body-structure topic and never show body organs for a particle topic.
- Local assets come first. If no local asset is suitable, OR an external reference would materially teach the concept better, use one or more specific "image: <2-6 search keywords> sync:<phrase>" directives. Prefer clean educational diagrams/illustrations for structures (keywords like "human skeleton diagram labeled"); use photographs only when a real-world visual is more useful. Never fetch images for equations or text. Avoid repeating the same image unless repetition serves a teaching purpose.
- Use "highlight: <phrase> style:circle|underline" for the ONE key term per scene (phrase must appear in the scene's heading or a text element).
- LABEL EVERY DIAGRAM: every draw: gets a short sync: phrase naming the structure. Viewers must always read what they are looking at.
- Equations use "->[condition]" arrows, e.g. equation: 6CO2 + 6H2O ->[light] C6H12O6 + 6O2
- For physics scenes use arrows with explicit from:x,y to:x,y in 1920x1080 coordinates.
- ${SUBJECT_RULES[subject]}

FORMAT EXAMPLE
@title ${topic}
@subject ${subject}

scene title
heading: ${topic}
sub: A Shiney Brain Academy lesson
narration: Welcome to Shiney Brain Academy. Today we explore ${topic}, step by step, the way you will need it for your exams.
draw: general.teacher sync:Welcome to Shiney Brain scale:0.5
draw: general.book sync:explore ${topic} scale:0.8
highlight: ${topic} style:underline

scene concept
heading: The Big Idea
narration: The big idea is simple and we will build it slowly. Watch the board carefully as each part appears exactly when I mention it.
text: One step at a time
draw: general.person-thinking sync:Watch the board scale:0.45
draw: general.lightbulb sync:big idea scale:0.8

NOW WRITE THE SCRIPT for "${topic}".`;
}
