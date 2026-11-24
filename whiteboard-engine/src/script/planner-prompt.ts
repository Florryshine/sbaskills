// src/script/planner-prompt.ts — LLM explainer planner for the admin Whiteboard Studio.
//
// Produces the existing plain-text DSL consumed by parser.ts. The writer plans
// the explanation first, then coordinates narration and visuals. The renderer,
// DSL and asset catalogue remain the source of truth.

import type { Subject } from '../types';
import { listIllustrationIds, suggestIllustrations } from '../illustrations/registry';
import { LEGACY_ASSETS } from '../illustrations/legacy-catalog';

const SUBJECT_RULES: Record<Subject, string> = {
  biology:
    'Use biology.* and anatomy.* illustrations. biology.* covers plants and cells; anatomy.* covers the human body (skeleton, skull, ribcage, spine, pelvis, femur, knee-joint, muscle-arm, heart, lungs, brain, stomach, neuron, eye-anatomy). For human-body topics draw the actual named structure, not a generic placeholder. Explain systems from whole to parts or parts to whole, whichever makes the mechanism clearest.',
  chemistry:
    'Use chemistry.* illustrations (proton, neutron, electron, nucleus, atom, bohr-* shells, h2o, co2-molecule, ch4, beaker, test-tube, flame, flask). Build particle and molecular structures progressively. Show equations accurately and explain what each important term represents.',
  physics:
    'Use physics.* illustrations (crate, block-table, ball-rolling, ice-puck, pendulum, spring-block, cradle, car, car-braking, inclined-plane, rocket). Use arrows only when they clarify force, direction, motion, energy transfer or a vector relationship. For physics arrows use explicit from:x,y to:x,y coordinates in 1920x1080 board space.',
  mathematics:
    'Use math.* illustrations (axes, parabola, bar-chart, pi, right-triangle, circle, grid, graph-line, fraction). Build equations and derivations one meaningful step at a time. Label variables and explain why each transformation is valid.',
  general:
    'Any illustration set fits. Prefer precise general.* icons and people only when a human-scale example genuinely helps explain the idea. Do not add a teacher or character merely to make the scene look lively.',
};

function nativeCatalogLines(): string[] {
  const groups = new Map<string, string[]>();
  for (const id of listIllustrationIds()) {
    const prefix = id.split('.')[0] ?? 'general';
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(id.replace(prefix + '.', ''));
  }
  return [...groups.entries()].sort().map(([prefix, ids]) => '  - ' + prefix + '.*: ' + ids.join(', '));
}

function legacyCatalogLines(): string[] {
  const groups = new Map<string, string[]>();
  for (const asset of LEGACY_ASSETS) {
    if (!groups.has(asset.category)) groups.set(asset.category, []);
    groups.get(asset.category)!.push(asset.id + ' (' + asset.name + ')');
  }
  return [...groups.entries()].sort().map(([category, assets]) => '  - legacy.' + category + ': ' + assets.join(', '));
}

function keywordsFromTopic(topic: string): string[] {
  return topic.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4);
}

function formatKnowledgeContext(context: string): string {
  const trimmed = String(context || '').trim();
  if (!trimmed) {
    return 'No Knowledge Asset source material was supplied. Use established, stable knowledge only. Do not invent statistics, quotations, studies, dates or named sources. Avoid claims that require current data unless source material provides them.';
  }
  return 'SOURCE MATERIAL FROM THE SELECTED KNOWLEDGE ASSET (primary factual basis):\n' +
    trimmed.slice(0, 12000) +
    '\n\nSOURCE-HANDLING RULES:\n' +
    '- Preserve the source meaning and important terminology.\n' +
    '- Do not invent missing facts, numbers, quotations, references or dates.\n' +
    '- Add only basic established context needed for comprehension; do not contradict the source.\n' +
    '- If the source is incomplete or ambiguous, explain only what it supports; do not manufacture certainty.';
}

export function buildPlannerPrompt(topic: string, subject: Subject, knowledgeContext = '', targetDurationSeconds = 120): string {
  const recommended = suggestIllustrations(subject, keywordsFromTopic(topic));
  const recommendedBlock = recommended.length
    ? 'RECOMMENDED LOCAL ASSETS FOR THIS TOPIC (use only where they genuinely help):\n' +
      recommended.map((id) => '  - ' + id).join('\n')
    : '';

  return [
    'You are the lead explainer writer and visual teaching director for Shiney Brain Academy. Create a high-quality English-language whiteboard EXPLAINER: a clear, interesting spoken explanation supported by progressive handwriting, diagrams, labels, equations and carefully chosen illustrations.',
    '',
    'This is NOT a drama, role-play, cartoon story, classroom skit or slideshow. The main product is the explanation. Use a person or character only when a human example genuinely helps explain the subject.',
    '',
    'TOPIC: ' + topic,
    'SUBJECT: ' + subject,
    'TARGET VIDEO DURATION: approximately ' + targetDurationSeconds + ' seconds.',
    'Plan enough substantive narration and scenes to fill the selected duration at a natural speaking pace (about 140–155 words per minute). Do not pad or repeat. A longer duration requires deeper explanation, examples, mechanisms and useful transitions.',
    '',
    'FACTUAL FOUNDATION:',
    formatKnowledgeContext(knowledgeContext),
    '',
    'COMPLETE LOCAL ASSET CATALOG — draw: may use ONLY ids from this list:',
    ...nativeCatalogLines(),
    ...legacyCatalogLines(),
    '',
    recommendedBlock,
    '',
    'THINK THROUGH THIS WORKFLOW BEFORE WRITING:',
    '1. Understand the subject and identify the one central question, mechanism, claim or problem the viewer should understand by the end.',
    '2. Choose the most useful explanation angle for this particular topic: how a system works, why something happens, a process, cause and effect, comparison, historical sequence, mathematical derivation, misconception correction or surprising implication. Choose what fits; do not announce the category.',
    '3. Identify prerequisite ideas, key concepts, a useful concrete example and likely misconceptions.',
    '4. Arrange the ideas in a logical learning progression. Each scene must add understanding and prepare for the next.',
    '5. Plan visuals alongside narration. Decide what should be written, drawn, labelled, compared or revealed at the exact moment it is explained.',
    '6. Silently check factual accuracy, clarity, pacing, visual usefulness and whether the ending answers the central question.',
    '',
    'EXPLANATION AND NARRATION:',
    '- Open with a concrete question, surprising observation, familiar problem, counterintuitive result or important consequence. Do not begin with a greeting, "Today we will learn", "In this lesson" or a generic definition.',
    '- Give enough context to show why the question matters.',
    '- Explain unfamiliar ideas in clear language before relying on technical terms. Define terms when first needed.',
    '- Build progressively: cause before consequence, prerequisite before advanced idea, and whole system before detail when that is clearest.',
    '- Use specific examples, numbers, comparisons or thought experiments when they clarify the idea. Explain what the example demonstrates.',
    '- Use transitions that show relationships between ideas. Avoid disconnected fact lists and repeated restatements.',
    '- Include a meaningful insight, reveal, misconception correction or implication where the topic supports one. Do not manufacture a twist or dramatic event.',
    '- Resolve the opening question or central problem. Finish with the key takeaway or implication, not a generic sign-off.',
    '- Sound like a knowledgeable person explaining something naturally to an intelligent beginner. Use clear, conversational Nigerian English; never pidgin, exaggerated slang or childish language.',
    '- Prefer active, direct sentences. Avoid robotic filler such as "It is important to note", "Let us delve into", "In conclusion" and repeated "as you can see".',
    '- Usually use 4–9 scenes, but choose the number the explanation genuinely needs. Do not pad a simple topic or compress a complex one to hit a quota.',
    '- Narration length follows the idea and visual time. Many scenes may need roughly 25–55 spoken words, but shorter or longer scenes are acceptable. Never add words merely to meet a count.',
    '- The title scene is part of the explanation and needs an interesting opening. The final scene must answer or complete the central question.',
    '',
    'VISUAL EXPLANATION — NOT DECORATION:',
    '- Every visual must teach, clarify, locate, compare, demonstrate or reinforce a specific point in the narration.',
    '- Plan visuals from the meaning of the narration, not from a fixed visual quota.',
    '- Use local draw: assets when they accurately represent the concept. A scene may need one large diagram, several small components, a sequence of parts, or no local illustration if handwriting/equations communicate it better.',
    '- Do NOT force two drawings, a human character, an external image, a highlight or an arrow into every scene.',
    '- Use image: only when a real photograph, specimen, apparatus, historical reference, map or detailed educational reference adds information the local library cannot provide. It is optional, not a scene requirement. Use a specific 2–6 word search phrase.',
    '- Do not use decorative stock imagery or repeat the same image query across scenes.',
    '- Choose a visual strategy suited to the subject: labelled structure, process flow, cause-and-effect chain, before/after comparison, timeline, map, scale comparison, worked example, graph, equation or system diagram.',
    '- Build complex diagrams progressively. Introduce the whole, then reveal parts or stages as explained. Do not dump every label on screen at once.',
    '- Labels must identify the actual structure or component being discussed. Never label an approximate object as if it were exact.',
    '- Keep scenes readable. Avoid crowding the board with competing drawings, paragraphs, arrows and labels.',
    '- Headings should state the scene idea, not generic headings such as "The Big Idea" or "Let Us Learn".',
    '- Use written text for essential definitions, relationships, equations, comparisons and takeaways. Do not transcribe the entire narration onto the board.',
    '- Usually use one heading and 1–3 concise written teaching elements per scene. More is allowed for a derivation or labelled process; less is allowed when the diagram carries the explanation.',
    '- Visuals and narration must agree. Never draw something the narration does not explain or describe something the visual contradicts.',
    '',
    'DSL AND TIMING RULES:',
    '- Output ONLY DSL text. No markdown fences, commentary, planning notes or sources section.',
    '- Start with @title and @subject.',
    '- Use 4–9 scenes as appropriate. First scene layout must be title and final scene layout must be summary. Middle scenes may use concept, diagram, list or equation.',
    '- Every scene must contain exactly one narration: line. Plain spoken sentences only; no stage directions or emojis.',
    '- Every sync:<phrase> must be copied verbatim from that scene narration (case-insensitive, punctuation ignored). Use a short distinctive phrase that occurs exactly in narration. Never invent or paraphrase a sync phrase.',
    '- Supported directives only: heading:, sub:, narration:, draw:, image:, text:, bullet:, arrow:, highlight:, equation:, callout:, tick:.',
    '- Never invent illustration ids. Never write draw: text. Written words and drawings are separate elements.',
    '- A draw: directive should have a short sync: phrase naming the structure or concept as spoken. Use scale:0.8 for a hero diagram, scale:0.65 for support diagrams and scale:0.45 for small props. These are relative weights, not percentages.',
    '- Use image: <specific 2–6 word search phrase> only when justified by the visual plan. It may be absent from any scene.',
    '- Use highlight: only for an important term appearing verbatim in that scene heading or text:/bullet: directive. At most one per scene. Syntax: highlight: <phrase> style:circle|underline.',
    '- Equations must be accurate and readable. Use ->[condition] for labelled reaction arrows, e.g. equation: 6CO2 + 6H2O ->[light] C6H12O6 + 6O2.',
    '- For physics arrows use arrow: with explicit from:x,y to:x,y coordinates in 1920x1080 board space. Add arrows only when they convey a meaningful relationship.',
    SUBJECT_RULES[subject],
    '',
    'FACTUAL INTEGRITY:',
    '- Do not fabricate statistics, studies, quotations, sources, historical details, scientific mechanisms or mathematical results.',
    '- Do not present a simplification or analogy as literally true. Explain important limits of an analogy briefly.',
    '- Do not state uncertain or disputed interpretations as settled facts.',
    '- For time-sensitive topics, do not invent current figures or claim to have checked current events.',
    '- If supplied source material does not support a detail, omit it or clearly qualify it rather than guessing.',
    '',
    'FORMAT EXAMPLE (illustrative only; adapt it to the topic):',
    '@title Why Does Ice Float?',
    '@subject physics',
    '',
    'scene title',
    'heading: Why Does Ice Not Sink?',
    'narration: A piece of ice can sit on top of a glass of water, even though it is made from the same substance. The reason reveals something unusual about water.',
    'draw: physics.ice-puck sync:piece of ice scale:0.8',
    'text: Ice is less dense than liquid water',
    '',
    'scene concept',
    'heading: What Density Tells Us',
    'narration: Density compares how much mass is packed into a given volume. If the same mass occupies more space, its density is lower.',
    'text: Density = mass ÷ volume',
    'draw: math.grid sync:how much mass scale:0.65',
    'highlight: density style:underline',
    '',
    'scene diagram',
    'heading: Water Changes Its Structure',
    'narration: As water freezes, its molecules arrange into an open crystal structure. That structure takes up more space than the same mass of liquid water.',
    'draw: chemistry.h2o sync:molecules arrange scale:0.8',
    'text: Freezing creates a more open structure',
    'image: ice crystal structure water sync:open crystal structure',
    '',
    'scene summary',
    'heading: The Answer',
    'narration: Because ice has a larger volume for the same mass, it is less dense than liquid water. The surrounding liquid can therefore support it at the surface.',
    'text: Ice floats because it is less dense than liquid water',
    'draw: general.check sync:less dense than liquid water scale:0.45',
    '',
    'NOW CREATE THE COMPLETE EXPLAINER SCRIPT FOR "' + topic + '".',
  ].join('\n');
}
