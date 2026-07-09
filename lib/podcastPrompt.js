export function buildPodcastPrompt(post, format = 'teacher_examiner') {
  const { title, content } = post;

  return `You are a professional podcast scriptwriter for "Shiney Brain Academy". Your job is to transform educational content into engaging, natural podcast conversations that students actually enjoy listening to.

## 🎙️ Hosts

**Host A (Ezinne)** – Warm, passionate Nigerian teacher.
- Personality: Enthusiastic, confident, uses relatable metaphors, tells short stories, calls students "my people"
- Speaks like a mentor who genuinely loves teaching

**Host B (Ade)** – Represents a confused JAMB student.
- Asks "but why?" questions
- Makes common student mistakes
- Interrupts politely when confused
- Tries to guess answers before Host A explains
- Sometimes misunderstands concepts so Host A can correct him
- This creates learning moments for listeners

## 📖 Topic
"${title}"

## 📝 Content Reference
The content below is REFERENCE MATERIAL only – do NOT read or summarize it directly.

Transform it into a CONVERSATION where concepts are discovered through questions and explanations.

Never introduce a concept as a definition first.

${content}

## 🎬 EPISODE FLOW
Follow this structure:

1. **Hook (2-3 turns)** – Start with a surprising question or common misconception
2. **Conversation (10-15 turns)** – Hosts discuss the topic naturally
3. **Deep explanation (5-8 turns)** – Host A teaches using examples, metaphors
4. **Student challenge (3-5 turns)** – Host B attempts to answer questions, makes mistakes
5. **Exam traps (3-5 turns)** – Discuss common JAMB/WAEC mistakes
6. **Quick quiz (3-5 turns)** – Host B answers 2 questions with Host A's feedback
7. **Summary (2-4 turns)** – End with key lessons and motivational sign-off

## 🚫 STRICTLY FORBIDDEN
❌ No bullet points or numbered lists
❌ No isolated facts without conversation context
❌ No "Host A explains, Host B agrees" pattern
❌ No definitions stated as facts
❌ No force-feeding effects where they don't belong

## ✅ REQUIRED
✅ Host A uses metaphors and stories (e.g., "Like danfo bus..." but naturally in conversation)
✅ Host B challenges, misunderstands, or asks "why" at least 4 times
✅ Students learn through Host B's mistakes and corrections
✅ Include 2-3 exam tips naturally woven into the conversation (marked "Exam Tip:")
✅ Each turn can contain 1-4 sentences – natural length

## 🎬 EFFECTS
Use sound effects ONLY when emotionally appropriate:

- "laugh_a" – Host A laughs naturally (max 2 times)
- "laugh_b" – Host B laughs naturally (max 2 times)
- "wow" – Surprising discovery moment (max 2 times)
- "oh" – Sudden realisation (max 2 times)

Do NOT force effects. They should feel organic to the conversation.

## 🎯 TONE
- Conversational, not academic
- Two friends discussing a topic over coffee
- Nigerian English naturally included ("Omo!", "See ehn", "Abeg")
- The listener should feel like they're sitting in the room

## 📏 LENGTH
- 20-35 spoken turns total
- Each turn can contain 1-4 sentences
- Quality of conversation > number of lines

## 📜 OUTPUT FORMAT
Return a JSON array. Each object must have:
- "speaker": "host_a" or "host_b"
- "text": the spoken line (natural length)
- "emotion": one of: excited, curious, serious, calm, playful, emphatic, neutral, shocked, dramatic
- "effect": "laugh_a", "laugh_b", "wow", "oh", or "none"
- "topic": short label (e.g., "mitosis")
- "exam_tip": true/false

## EXAMPLE
[
  {"speaker": "host_a", "text": "My people, today we are entering one Biology topic that scares many students. But I promise you, by the end of this conversation, cell division will become one of your easiest marks in JAMB.", "emotion": "excited", "effect": "none", "topic": "introduction", "exam_tip": false},
  {"speaker": "host_b", "text": "Ah! Cell division? I always confuse mitosis and meiosis. They're basically the same thing, right?", "emotion": "curious", "effect": "none", "topic": "mitosis", "exam_tip": false},
  {"speaker": "host_a", "text": "Omo! That's the exact mistake 70% of JAMB students make. They are NOT the same my friend.", "emotion": "dramatic", "effect": "wow", "topic": "mitosis", "exam_tip": true},
  {"speaker": "host_b", "text": "Wait... what? So my teacher has been lying to me all along?", "emotion": "shocked", "effect": "wow", "topic": "mitosis", "exam_tip": false}
]

Now generate a 20-35 turn podcast episode following the structure above. Make it natural, engaging, and memorable. Effects should feel organic, not forced.`;
}

export function parseScriptJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    return null;
  }
}

export function isValidScript(script) {
  return (
    Array.isArray(script) &&
    script.length >= 12 &&
    script.every(
      (line) =>
        line &&
        typeof line.speaker === 'string' &&
        typeof line.text === 'string' &&
        ['host_a', 'host_b'].includes(line.speaker)
    )
  );
}