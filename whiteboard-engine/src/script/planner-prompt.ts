// src/script/planner-prompt.ts — LLM lesson planner for the admin Whiteboard Studio.
//
// The prompt turns a topic + subject into the same DSL the deterministic
// parser accepts, so the AI path and the paste-script path share one schema.
// The route validates the result with parseScript() and repairs/reflects on
// failure (see lib/whiteboard usage in the app).

import type { Subject } from '../types';
import { listIllustrationIds } from '../illustrations/registry';
import { listLegacyIllustrationIds } from '../illustrations/legacy-catalog';

const SUBJECT_RULES: Record<Subject, string> = {
  biology: 'Use biology.* illustrations (plant, leaf, sun, water-drop, co2-cloud, chloroplast, cell, dna, flower, tree, roots, seedling, o2-bubbles). Draw living systems part by part.',
  chemistry: 'Use chemistry.* illustrations (atom, nucleus, proton, neutron, electron, bohr-* shells, h2o, co2-molecule, ch4, beaker, test-tube, flame, flask). Build structure from particles upward, and always show equations term by term.',
  physics: 'Use physics.* illustrations (crate, block-table, ball-rolling, ice-puck, pendulum, spring-block, cradle, car, car-braking, inclined-plane, rocket). Always add force/motion arrows with from:/to: coordinates near the object.',
  mathematics: 'Use math.* illustrations (axes, parabola, bar-chart, pi, right-triangle, circle, grid, graph-line, fraction). Build equations progressively and label every part.',
  general: 'Any illustration set fits. Prefer general.* icons (lightbulb, book, brain, check, question, star, target, clock).',
};

export function buildPlannerPrompt(topic: string, subject: Subject): string {
  const assets = [...listIllustrationIds(), ...listLegacyIllustrationIds()].join(', ');
  return `You are the script planner for Shiney Brain Academy's whiteboard video engine.
Act as the senior visual lesson director for Shiney Brain Academy. Write a complete, visually rich lesson in the engine's DSL so it can be rendered as a narrated whiteboard animation where a teacher writes and draws while speaking. Every visual must directly support a spoken teaching point. For anatomy, show accurate structures; for processes, show meaningful stages; for chemistry, distinguish particles, apparatus, reactants and products; for physics, show the actual setup and relevant forces. Do not rely on labels embedded in fetched images. Avoid both under-illustration and clutter.

TOPIC: ${topic}
SUBJECT: ${subject}

RULES
- Output ONLY the DSL text, no markdown fences, no commentary.
- 4 to 6 scenes. First scene layout "title", last scene layout "summary".
- Middle scenes use "concept", "diagram", "list" or "equation" layouts.
- Every scene MUST have one "narration:" line of 20-40 words of warm, teacherly Nigerian-English narration. Plain sentences, no stage directions, no emojis.
- Every element must be synced to narration with sync:<phrase> where <phrase> is an EXACT substring of that scene's narration (e.g. sync:sunlight when the narration says "sunlight").
- There is NO fixed illustration-count limit per scene. Choose the number of illustrations according to the teaching content: enough to explain all important structures, stages, components, comparisons and examples, without padding or clutter. A complex scene may need several focused visuals; a simple scene may need one. If the visuals cannot fit readably, distribute the explanation across scenes.
- Never invent illustration ids. Never write "draw: text". Words and drawings are separate.
- Search the local subject-specific illustration library first, then relevant general assets. Choose the most semantically and educationally suitable asset, not merely a vaguely related icon. If no local asset is suitable, OR an external reference would materially teach the concept better, use one or more specific "image: <2-6 search keywords> sync:<phrase>" directives. External images are fetched from free sources, traced into drawable pen strokes and progressively painted in colour. External search is a normal part of visual planning, not a last resort. Prefer clean educational diagrams/illustrations for structures and processes; use photographs when a real-world visual is more useful. Never fetch images for equations or text. Avoid repeating the same image unless repetition serves a teaching purpose.
- Use "highlight: <phrase> style:circle|underline" for the ONE key term per scene (phrase must appear in the scene's heading or a text element).
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
draw: general.book scale:0.9
highlight: ${topic} style:underline

scene concept
heading: The Big Idea
narration: The big idea is simple and we will build it slowly. Watch the board carefully as each part appears exactly when I mention it.
text: One step at a time
draw: general.lightbulb sync:big idea scale:0.8

NOW WRITE THE SCRIPT for "${topic}".`;
}
