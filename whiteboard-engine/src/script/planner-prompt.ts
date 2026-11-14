// src/script/planner-prompt.ts — LLM lesson planner for the admin Whiteboard Studio.
//
// The prompt turns a topic + subject into the same DSL the deterministic
// parser accepts, so the AI path and the paste-script path share one schema.
// The route validates the result with parseScript() and repairs/reflects on
// failure (see lib/whiteboard usage in the app).

import type { Subject } from '../types';
import { listIllustrationIds } from '../illustrations/registry';

const SUBJECT_RULES: Record<Subject, string> = {
  biology: 'Use biology.* illustrations (plant, leaf, sun, water-drop, co2-cloud, chloroplast, cell, dna, flower, tree, roots, seedling, o2-bubbles). Draw living systems part by part.',
  chemistry: 'Use chemistry.* illustrations (atom, nucleus, proton, neutron, electron, bohr-* shells, h2o, co2-molecule, ch4, beaker, test-tube, flame, flask). Build structure from particles upward, and always show equations term by term.',
  physics: 'Use physics.* illustrations (crate, block-table, ball-rolling, ice-puck, pendulum, spring-block, cradle, car, car-braking, inclined-plane, rocket). Always add force/motion arrows with from:/to: coordinates near the object.',
  mathematics: 'Use math.* illustrations (axes, parabola, bar-chart, pi, right-triangle, circle, grid, graph-line, fraction). Build equations progressively and label every part.',
  general: 'Any illustration set fits. Prefer general.* icons (lightbulb, book, brain, check, question, star, target, clock).',
};

export function buildPlannerPrompt(topic: string, subject: Subject): string {
  const assets = listIllustrationIds().join(', ');
  return `You are the script planner for Shiney Brain Academy's whiteboard video engine.
Write a lesson script in the engine's DSL so it can be rendered as a narrated whiteboard animation where a teacher writes and draws while speaking.

TOPIC: ${topic}
SUBJECT: ${subject}

RULES
- Output ONLY the DSL text, no markdown fences, no commentary.
- 4 to 6 scenes. First scene layout "title", last scene layout "summary".
- Middle scenes use "concept", "diagram", "list" or "equation" layouts.
- Every scene MUST have one "narration:" line of 20-40 words of warm, teacherly Nigerian-English narration. Plain sentences, no stage directions, no emojis.
- Every element must be synced to narration with sync:<phrase> where <phrase> is an EXACT substring of that scene's narration (e.g. sync:sunlight when the narration says "sunlight").
- Draw 1-3 illustrations per scene from this list: ${assets}
- Never invent illustration ids. Never write "draw: text". Words and drawings are separate.
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
