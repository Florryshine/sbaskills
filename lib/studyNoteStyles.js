// lib/studyNoteStyles.js
//
// Study Notes Style Engine. Same pattern as lib/podcastStyles.js: each
// style returns a complete, standalone prompt. All styles still return
// { "title": "...", "content": "<markdown>" } so nothing downstream
// (PDF renderer, study_note_drafts table, publish route) needs to change
// — only the shape of the markdown inside `content` differs per style.

function assetFields(asset) {
  const keyword = asset.keyword || 'this topic';
  const summary = asset.summary || 'No summary available.';
  const keyConcepts = (asset.key_concepts || []).map((k) => `- ${k}`).join('\n') || '- No key concepts.';
  const definitions =
    (asset.definitions || []).map((d) => `- **${d.term}**: ${d.definition}`).join('\n') || '- No definitions.';
  const examples = (asset.examples || []).map((ex) => `- ${ex}`).join('\n') || '- No examples.';
  const facts = (asset.facts || []).map((f) => `- ${f}`).join('\n') || '- No facts.';
  const commonMistakes =
    (asset.common_mistakes || []).map((m) => `- ${m}`).join('\n') || '- No common mistakes.';
  return { keyword, summary, keyConcepts, definitions, examples, facts, commonMistakes };
}

const JSON_FOOTER = `Return ONLY a JSON object:
{
  "title": "A suitable title",
  "content": "Full Markdown content"
}
No markdown fences, no commentary outside the JSON object.`;

export const STUDY_NOTE_STYLES = {
  note_only: {
    label: 'Standard Revision Notes',
    description: 'Overview, concepts, definitions, exam tips, summary table. Your original default.',
    buildPrompt(asset) {
      const f = assetFields(asset);
      return `You are an expert study note writer for Shiney Brain Academy. Create concise, well-structured revision notes on the topic: "${f.keyword}".

The notes should be in **Markdown** and suitable for printing as a PDF.

Sections:
## Overview
${f.summary}

## Key Concepts
${f.keyConcepts}

## Important Definitions
${f.definitions}

## Examples
${f.examples}

## Key Facts
${f.facts}

## Common Mistakes to Avoid
${f.commonMistakes}

## Exam Tips
- Look out for questions on [mention specific areas]
- Practice [specific skill]
- Use this mnemonic: [suggest one]

## Quick Summary Table
| Concept | Key Point |
|---------|-----------|
| ...     | ...       |

## Review Questions
- Q1: ... → A1: ...

${JSON_FOOTER}`;
    },
  },

  mcq_practice: {
    label: 'MCQ Practice Sheet',
    description: 'Short notes followed by a self-test MCQ set (A-D) with an answer key at the very end.',
    buildPrompt(asset) {
      const f = assetFields(asset);
      return `You are an expert exam-prep writer for Shiney Brain Academy, building a JAMB/WAEC/NECO-style multiple-choice practice sheet on: "${f.keyword}".

The output should be in **Markdown**, suitable for printing as a PDF.

Sections:
## Quick Recap
A short (4-6 sentence) recap of the topic, tight enough that a student could read it in under a minute before starting the questions. Base it on:
${f.summary}

Key concepts to draw questions from:
${f.keyConcepts}

Definitions to draw questions from:
${f.definitions}

Facts to draw questions from:
${f.facts}

Common mistakes (write distractor options that reflect these mistakes):
${f.commonMistakes}

## Practice Questions
Write 12-15 multiple-choice questions covering the material above. For EACH question:
- Number it (1., 2., 3., ...)
- Give exactly 4 options labeled A) B) C) D)
- Make wrong options genuinely plausible — base distractors on the common mistakes listed above, not obviously-wrong filler
- Vary difficulty: roughly a third easy/recall, a third applied, a third exam-trap level
- Do NOT reveal or hint at the answer here

## Answer Key
AFTER all questions, in a clearly separated final section, list the correct answer letter and a one-sentence reason for each question number, so students can self-check without seeing answers while attempting the set. Format: "1. C — because..."

${JSON_FOOTER}`;
    },
  },

  workbook: {
    label: 'Workbook (fill-in / worked exercises)',
    description: 'Fill-in-the-blank and worked exercises with space to write, answer key at the end.',
    buildPrompt(asset) {
      const f = assetFields(asset);
      return `You are an expert workbook author for Shiney Brain Academy, building an active-practice workbook page on: "${f.keyword}".

The output should be in **Markdown**, suitable for printing as a PDF a student writes directly into.

Sections:
## What You're Practicing
A 3-5 sentence framing of what skill/concept this workbook page builds, drawn from:
${f.summary}

## Fill in the Blanks
Write 6-8 fill-in-the-blank statements built from these concepts and definitions (use "______" for the blank, one key term or value missing per sentence — not whole phrases):
${f.keyConcepts}
${f.definitions}

## Worked Exercises
Write 3-4 exercises that require the student to work something out (a calculation, a labeling, a short-answer explanation, ordering steps). After each exercise prompt, include a blank space line "________________________________" for the student to write their answer. Base these on:
${f.examples}
${f.facts}

## Self-Check: Common Mistakes
Present these as a short checklist the student ticks off after finishing, framed as questions ("Did I remember to...?"), based on:
${f.commonMistakes}

## Answer Key
AFTER everything else, in a clearly separated final section, give the correct answers to every blank and exercise above, numbered to match.

${JSON_FOOTER}`;
    },
  },

  cheat_sheet: {
    label: 'One-Page Cheat Sheet',
    description: 'Ultra-condensed, bullet-only, built for last-minute exam-day review.',
    buildPrompt(asset) {
      const f = assetFields(asset);
      return `You are an expert at writing ultra-condensed exam cheat sheets for Shiney Brain Academy, on the topic: "${f.keyword}".

The output should be in **Markdown**, designed to fit on ONE printed page — dense, scannable, zero fluff. No paragraphs of prose anywhere; every line is a bullet, a short phrase, or a table row a student can glance at in the exam hall waiting room.

Source material:
Summary: ${f.summary}
Key concepts: ${f.keyConcepts}
Definitions: ${f.definitions}
Facts: ${f.facts}
Common mistakes: ${f.commonMistakes}

Sections:
## ${f.keyword} — Cheat Sheet

### Must-Know (top 3-5 facts, one line each)

### Definitions (term — one-line meaning, as a table)
| Term | Meaning |
|------|---------|

### Formulas / Rules (if applicable — otherwise omit this section entirely)

### Top Exam Traps (bullet list, each under 12 words)

### Last-Look Mnemonic
One short memorable line or acronym that recalls the whole topic.

Keep total length tight — this must read as "glance-able", not as a rewritten version of the standard notes.

${JSON_FOOTER}`;
    },
  },
};

export const DEFAULT_STUDY_NOTE_STYLE = 'note_only';

export function getStudyNoteStyle(styleId) {
  return STUDY_NOTE_STYLES[styleId] || STUDY_NOTE_STYLES[DEFAULT_STUDY_NOTE_STYLE];
}

export function listStudyNoteStyles() {
  return Object.entries(STUDY_NOTE_STYLES).map(([id, s]) => ({
    id,
    label: s.label,
    description: s.description,
  }));
}
