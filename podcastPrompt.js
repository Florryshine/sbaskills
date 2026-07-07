// ─── Podcast script prompt builder ──────────────────────────────────────

const EMOTIONS = ['neutral', 'curious', 'excited', 'calm', 'emphatic', 'playful', 'serious'];

/**
 * @param {{ title: string, content: string, topic_type?: string }} post
 * @param {'teacher_student'|'teacher_examiner'} format
 */
export function buildPodcastPrompt(post, format = 'teacher_examiner') {
  const personas =
    format === 'teacher_examiner'
      ? {
          host_a: 'HOST A — "Teacher": explains concepts clearly, gives relatable Nigerian examples',
          host_b:
            'HOST B — "Examiner": focuses on how JAMB/WAEC/NECO actually test this topic — common mistakes, likely exam phrasing, past-question patterns',
        }
      : {
          host_a: 'HOST A — "Teacher": explains concepts clearly, gives relatable Nigerian examples',
          host_b:
            'HOST B — "Student": asks the questions students are actually thinking, occasionally jokes, summarizes in simpler words',
        };

  return `You are writing a podcast script for Shiney Brain Academy, a Nigerian exam-prep platform (JAMB/WAEC/NECO/Post-UTME).

Turn the article below into a natural, engaging ${format === 'teacher_examiner' ? '"Teacher vs Examiner"' : '"Teacher vs Student"'} podcast conversation, about 8-12 minutes when spoken aloud (roughly 1200-1600 words total across both hosts).

ARTICLE TITLE: ${post.title}

ARTICLE CONTENT:
${post.content}

PERSONAS:
- ${personas.host_a}
- ${personas.host_b}

RULES:
1. Alternate speakers naturally. Neither host speaks more than 3-5 sentences before the other responds.
2. Include natural interruptions, "wait, really?", light humor, and relatable Nigerian analogies (NEPA/light, jollof rice, danfo bus, etc.) where they fit — but don't force one into every line.
3. Cover the actual substance of the article accurately. Don't invent facts not in the article.
4. End with a "Rapid Fire Revision" block: exactly 3 short Q&A exchanges where Host A asks a quick question, waits a beat, then Host B (or Host A) gives the answer with a one-line explanation. Tag these lines with "emotion": "excited".
5. Assign each line an "emotion" tag from this exact list: ${EMOTIONS.join(', ')}. Use it to reflect how the line should sound (curious question = "curious", big reveal = "excited", serious warning about a common mistake = "serious", etc).
6. Keep every single line under 40 words — this is spoken dialogue, not paragraphs.
7. Tag each line with metadata to power future filtering/search:
   - "topic": the specific sub-concept this line is about (e.g. "osmosis", "water potential"). Reuse the same topic string across consecutive lines on the same sub-concept.
   - "keywords": array of 0-3 exam-relevant terms mentioned in that line (empty array if none).
   - "exam_tip": true only if the line explicitly flags something JAMB/WAEC/NECO commonly tests or a common student mistake — otherwise false.
   - "difficulty": "easy", "medium", or "hard" — how advanced the concept in that line is.

Return ONLY a JSON array, no markdown fences, no commentary, in this exact shape:
[
  { "speaker": "host_a", "text": "...", "emotion": "curious", "topic": "osmosis", "keywords": ["osmosis", "cell membrane"], "exam_tip": false, "difficulty": "easy" },
  { "speaker": "host_b", "text": "...", "emotion": "neutral", "topic": "osmosis", "keywords": [], "exam_tip": true, "difficulty": "medium" }
]`;
}

export function parseScriptJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export function isValidScript(script) {
  return (
    Array.isArray(script) &&
    script.length >= 6 &&
    script.every(
      (line) =>
        line &&
        (line.speaker === 'host_a' || line.speaker === 'host_b') &&
        typeof line.text === 'string' &&
        line.text.trim().length > 0
    )
  );
}
