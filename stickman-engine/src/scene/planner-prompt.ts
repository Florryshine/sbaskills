/**
 * src/scene/planner-prompt.ts — LLM planner for the admin Stickman Studio.
 *
 * Turns a topic + subject (+ optional Knowledge Asset source material) into
 * the SceneScript JSON the deterministic compiler accepts, so the AI path and
 * the paste-script path share one schema. The COMPLETE action/camera/prop
 * vocabulary is interpolated below — the model can only use what it can see.
 *
 * Mirrors whiteboard-engine/src/script/planner-prompt.ts.
 */

const SCHEMA_EXAMPLE = `{
  "title": "Ben and Maya Learn About Friction",
  "fps": 30,
  "width": 720,
  "height": 1280,
  "environment": { "type": "street", "seed": 7, "time": "day" },
  "cast": {
    "ben": { "style": "ben" },
    "maya": { "style": "maya" }
  },
  "scenes": [
    {
      "id": "s1-hook",
      "env": { "type": "street", "seed": 7, "time": "day" },
      "cast": { "ben": { "x": -380, "facing": 1 } },
      "props": [ { "id": "lamp1", "type": "lamppost", "x": 300 } ],
      "actions": [ { "char": "ben", "do": "run", "from": -380, "to": -110, "speed": 300, "t0": 0.2 } ],
      "camera": [
        { "do": "establish", "scale": 1.7, "dur": 1.2 },
        { "do": "follow", "target": "ben", "scale": 2.0, "at": 1.2, "dur": 4.5 }
      ],
      "dialogue": [
        { "who": "narr", "text": "Meet Ben. Ben has a very important delivery, and Ben is in a hurry." }
      ]
    },
    {
      "id": "s2-explain",
      "cast": { "ben": { "x": -46, "facing": 1 }, "maya": { "x": 240, "facing": -1 } },
      "props": [
        { "id": "box", "type": "box", "x": 30, "w": 64, "h": 64,
          "moving": { "from": 30, "to": 180, "t0": 1.3, "t1": 2.5 } },
        { "id": "bench1", "type": "bench", "x": 300 }
      ],
      "actions": [
        { "char": "maya", "do": "present", "at": [10, -40], "t0": 0.4 },
        { "char": "maya", "do": "talkGestures", "line": 0, "stressEvery": 4, "t0": 2.2 }
      ],
      "camera": [
        { "do": "twoShot", "targets": ["ben", "maya"], "scale": 1.55, "at": 0.1, "dur": 3.0 },
        { "do": "focus", "point": [10, -40], "scale": 2.6, "at": 3.4, "dur": 3.4 }
      ],
      "overlays": [
        { "type": "formula", "t0": 3.4, "t1": 6.6, "text": "f = mu x N" },
        { "type": "arrows", "t0": 2.0, "t1": 6.6, "arrows": [
          { "from": [-2, -74], "to": [90, -74], "color": "#2285b7", "label": "push" }
        ] }
      ],
      "dialogue": [
        { "who": "maya", "text": "See those tiny bumps? When two surfaces rub, they grip. That is friction!" }
      ]
    }
  ]
}`;

function subjectRules(subject: string): string {
  switch (subject) {
    case 'physics':
      return 'Physics: stage the forces and motion literally. Use boxes to push/pull, arrows overlays for force vectors, formula overlays for equations (write mu as "mu"), reactSurprise for unexpected results, and let a character physically DO what the law says.';
    case 'chemistry':
      return 'Chemistry: use the abstract environment with an accent colour for "molecular world" scenes. Talk through reactions step by step; use formula overlays for equations written in plain ASCII (+, ->). Show mixing/heating with present/point gestures.';
    case 'biology':
      return 'Biology: keep characters as narrators and guides. Use present/point at off-screen positions for organs or structures, title overlays to name each part, and walk/establish shots to move through a system part by part.';
    case 'mathematics':
      return 'Mathematics: use formula overlays for each step of a derivation (plain ASCII, e.g. "a^2 + b^2 = c^2"), focus camera on the formula area, and have one character teach while the other reacts (talkGestures, reactSurprise, cheer after solving).';
    default:
      return 'General: pick whichever staging makes the idea clearest; a street/classroom story with two characters (ben + maya) works well.';
  }
}


function storytellingRules(): string {
  return `STORY DESIGN — choose the best approach for THIS topic; do not use one formula every time.
Before writing, silently consider several possible treatments and choose the one with the strongest natural story potential. Possible approaches include:
- character-driven drama or conversational comedy;
- mystery, investigation or problem-solving;
- action, adventure, challenge or survival;
- competition, rivalry or a race against time;
- discovery, experiment or documentary-style revelation;
- relatable everyday situation, misunderstanding or unexpected consequence;
- what-if scenario, transformation or emotional journey.
You may combine approaches when it genuinely improves the story. Do not announce the chosen style in the output.

CORE STORY REQUIREMENTS:
- Make the opening immediately interesting: begin with an unusual event, urgent problem, provocative question, funny situation, surprising discovery or character goal. No greetings, lesson announcements or generic "Today we will learn..." openings.
- Give the viewer a clear reason to continue: establish a question, goal, mystery, challenge, conflict or anticipated outcome.
- Give every character a clear role, motivation and recognisable way of speaking. Dialogue should sound like people responding to each other, not like a textbook split between character names.
- Let events cause other events. Prefer a clear "but / therefore" chain over a list of unrelated things that merely happen one after another.
- Develop the situation across scenes. Introduce meaningful new information, obstacles, decisions, reactions, clues, consequences or reversals. Do not repeat the same point in different words.
- Use humour, suspense, emotion, surprise or tension only when appropriate to the selected approach. Do not force a villain, accident, argument, twist or emotional scene into every script.
- Deliver a satisfying payoff: resolve the central question or goal, make the outcome understandable, and leave the viewer with a memorable insight.
- The educational idea must be accurate and genuinely understood through what happens. Integrate explanations at the moment they become relevant; do not pause the story for a long textbook lecture.
- Never invent scientific facts, historical claims, statistics or named real people. If the source material does not support a detail, leave it out or keep the scenario clearly fictional.

SCENE-TO-ANIMATION PLANNING:
- The script and animation plan are one coordinated SceneScript. Plan visible action while writing the story; do not write dialogue first and add random movements afterwards.
- Every scene must change something or serve a clear purpose: establish, reveal, react, attempt, fail, discover, decide, demonstrate, escalate, resolve or pay off.
- Use actions, facial expressions, props, camera framing and overlays to make the important story beats visible. Let characters react to each other and to events.
- Match movement to the moment: a reveal can use a focus or shake; a conversation can use a twoShot; an important object can be presented or picked up; a chase can use run/follow; a discovery can use a focused overlay. Use only supported schema actions and camera intents listed below.
- Do not add movement merely to satisfy a quota. Calm scenes, close conversations and documentary-style narration are valid when visually purposeful.
- Keep the screen composition readable. Avoid too many actions, props, overlays or dialogue lines competing in one scene.
- Make each scene's dialogue, action, camera and overlays agree with one another and with the narration.
- Vary scene rhythm and visual framing where the story benefits; avoid repeating the same two-shot, point gesture and formula overlay in every scene.

SILENT QUALITY CHECK BEFORE OUTPUT:
1. Is the opening compelling without a long introduction?
2. Is there a clear story question, goal, conflict, discovery or journey?
3. Does each scene move the story forward?
4. Do the characters sound distinct and natural?
5. Is the educational content accurate and naturally integrated?
6. Are there meaningful developments and a satisfying payoff?
7. Can the animation compiler actually stage every action using the supported schema?
8. Could any scene be removed without losing story or understanding? If yes, improve or remove it.
Revise the script silently until these checks are satisfied. Return only the required JSON.`;
}

export function buildPlannerPrompt(topic: string, subject: string, kaSource = ''): string {
  const source = kaSource
    ? `\n\nSOURCE OF TRUTH (teaching material for "${topic}" — ground every fact in it, do not invent facts, statistics or names):\n"""\n${kaSource.slice(0, 6000)}\n"""\n`
    : `\nYou are creating an original short educational story. Teach only well-established facts about "${topic}".\n`;

  return `You are the head writer of an animated educational series for Nigerian secondary-school students (JAMB/WAEC level) at Shiney Brain Academy. Write a Stickman SceneScript: a JSON document that a deterministic animation compiler turns into a cartoon where simple 2D stick characters walk, push boxes, point at things and talk.

TOPIC: ${topic}
SUBJECT: ${subject}
${subjectRules(subject)}

${storytellingRules()}${source}

OUTPUT FORMAT — return STRICT JSON, no markdown fences, exactly this shape:
{"script": { ...SceneScript below... }}

SCENESCRIPT RULES (the validator rejects anything else):
- title: short video title (max 80 chars), NOT the topic restated verbatim. Make it story-flavoured, e.g. "Ben and the Stubborn Box".
- environment (top-level): one of {"type":"street","seed":<int>,"time":"day"} | {"type":"abstract","seed":<int>,"accent":"#2285b7"} | {"type":"classroom","seed":<int>}. The same environment should repeat across scenes unless the story changes world (a scene may override with "env").
- cast: 1-2 characters. Styles: "ben" (orange hoodie), "maya" (blue hoodie), "prof" (classic black). Example: {"ben":{"style":"ben"},"maya":{"style":"maya"}}.
- scenes: usually 5-9 scenes, adapting the count to the story; never exceed the validator's 12-scene maximum. Give each scene a unique id like "s1-hook". Do not pad the story to reach a scene count.
- Every scene with characters positions them in its "cast" map with a numeric starting x (world units; keep x between -400 and 500) and optional facing (1 right, -1 left).
- dialogue: who is a cast id or "narr" (narrator). 1-3 lines per scene, each under 220 characters, natural spoken English, exam-relevant, NEVER markdown. Line "t0" (scene-relative seconds) is optional; lines without t0 play one after another with a 0.4s gap starting at 0.35s.
- actions use ONLY these verbs: walk (from,to; speed), run (from,to), jump/land (optional height), push/pull (prop id), pickUp/throw (prop id), carry/drop (optional prop id), clap, dance, fall, getUp/stand, sit, point/present (at:[x,y]), wave, reactSurprise, cheer, laugh, stumble, face/turn (facing:1 or -1), talkGestures (line index), expression (emotion). Supported emotions: neutral, talk, happy, bigsmile, worried, strain, surprised, proud, sad, crying, angry, fear, confused, wink, focused. Use expression events to match story reactions; use pickUp then carry then drop/throw for object handling. Actions can overlap across different characters so they react to one another. Each action has t0 and optional dur (scene-relative seconds).
- ACTION DISCIPLINE: keep characters moving and interacting when the topic allows. Motion topics (speed, velocity, friction, force, energy) -> at least one walk or run action per scene. Interaction topics (Newton's third law, sharing, conversation, teamwork) -> use approach/leanIn/recoil between characters. Never leave two idle characters through a motion topic. Use point/present when the narrator explains a formula or diagram.
- INTERACTION actions (Phase C — use to make characters react to each other): approach(target, dur), retreat(target, dur), faceToward(target), leanIn(target, dur), recoil(target, dur). Example: characters discussing friction → ben 'leanIn' maya → maya 'recoil' → both reactSurprise. Use 'approach' before dialogue when a character needs to close distance.
- camera intents ONLY: establish (optional scale ~1.5-1.9, drift), focus (point:[x,y], scale ~2.4-3.2), follow (target: cast id), twoShot (targets:[idA,idB]), shake (at, amp). Add "at" (seconds) and "dur". A scene without camera gets a plain establishing shot.
- props ONLY: box (x, optional w/h ~40-80, optional moving:{from,to,t0,t1}), easel, lamppost, bench, plant — each with an id and numeric x. Repeat the props a scene needs in every scene that uses them (props do not carry over between scenes).
- overlays (scene-relative seconds, t0<t1): title {text, sub?}, formula {text} (plain ASCII math only: + - = ^ mu x N; keep formulas 3-12 chars, use standard symbols like v = d/t or F = ma; do NOT write half-formulas or bare fractions), arrows {arrows:[{from:[x,y],to:[x,y],color:"#hex",label}]}. Overlays are the main teaching surface — put the key term, formula or diagram label on screen while the narrator explains it.
- Numbers: keep the total video under 100 seconds.

EXAMPLE (shape only — write ORIGINAL content for the topic, do not copy this story):
${SCHEMA_EXAMPLE}

Return strict JSON: {"script": <SceneScript>}. The JSON must be complete and parseable — no comments, no trailing commas, no ellipses.`;
}
