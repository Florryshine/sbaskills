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
      return 'General: choose the clearest visual treatment for this topic. Use one character, multiple characters, or no visible character in a scene when narration, props, diagrams or visual media communicate better. Never force a two-character conversation.';
  }
}

export function buildPlannerPrompt(topic: string, subject: string, kaSource = ''): string {
  const source = kaSource
    ? `\n\nSOURCE OF TRUTH (teaching material for "${topic}" — ground every fact in it, do not invent facts, statistics or names):\n"""\n${kaSource.slice(0, 6000)}\n"""\n`
    : `\nYou are creating an original short educational story. Teach only well-established facts about "${topic}".\n`;

  return `You are the head writer AND animation director of an animated educational series for Nigerian secondary-school students (JAMB/WAEC level) at Shiney Brain Academy. Write a SceneScript for a lively, well-directed educational cartoon. Characters are simple 2D stick figures, but their movement, timing, staging and physical actions must feel deliberate and readable. Do not assume every scene needs two characters or even a character.

TOPIC: ${topic}
SUBJECT: ${subject}
${subjectRules(subject)}${source}

OUTPUT FORMAT — return STRICT JSON, no markdown fences, exactly this shape:
{"script": { ...SceneScript below... }}

SCENESCRIPT RULES (the validator rejects anything else):
- title: short video title (max 80 chars), NOT the topic restated verbatim. Make it story-flavoured, e.g. "Ben and the Stubborn Box".
- environment (top-level): one of {"type":"street","seed":<int>,"time":"day"} | {"type":"abstract","seed":<int>,"accent":"#2285b7"} | {"type":"classroom","seed":<int>}. The same environment should repeat across scenes unless the story changes world (a scene may override with "env").
- cast: choose the number of characters the story genuinely needs. There is NO fixed requirement to use two. One character is completely valid; use two or more only when dialogue, conflict, teamwork, a crowd, demonstration or story staging benefits. You may use up to 20 visible characters in a scene (and up to 24 defined in the overall cast). Reuse character IDs/styles consistently across scenes; several characters may share a visual style. Available styles: "ben" (orange hoodie), "maya" (blue hoodie), "prof" (classic black). Give each character a clear role; do not add characters just to fill space.
- scenes: 4-8 scenes, each 4-10 seconds. Give each scene a unique id like "s1-hook".
- Every scene with characters positions them in its "cast" map with a numeric starting x (world units; keep x between -400 and 500) and optional facing (1 right, -1 left).
- dialogue: who is a cast id or "narr" (narrator). 1-3 lines per scene, each under 220 characters, natural spoken English, exam-relevant, NEVER markdown. Line "t0" (scene-relative seconds) is optional; lines without t0 play one after another with a 0.4s gap starting at 0.35s.
- CHARACTER COUNT & STAGING: do not default to Ben + Maya. Choose the smallest effective cast for each story. A solo character can demonstrate, explore, narrate, discover or perform an experiment. Add partners for genuine interaction; add groups/crowds only when the scene needs them. The top-level cast may define up to 24 reusable characters; each scene should stage only the characters visible in that scene. Never put all cast members on screen automatically. Character IDs are arbitrary stable identifiers; visual styles may be reused.
- ACTION DIRECTION: characters should not hold one pose for an entire scene. Use a sequence of short, purposeful actions with clear start/end times: move into position, perform the action, react, then settle or move on. Use walk/run/jump/land/turn/stand/getUp/sit and object interactions where the story calls for them. Avoid repetitive pointing, constant leaning, and unnecessary bending. Keep a character upright by default; bend only to pick up, inspect, sit, brace or perform an action that physically requires it. A walk/run must travel visibly across the scene, not just cycle legs in place. Give actions realistic durations and avoid overlapping actions that fight for the same character's body.
- actions use ONLY these verbs: walk (from,to; speed), run (from,to), jump/land (optional height), push/pull (prop id), pickUp/throw (prop id), carry/drop (optional prop id), clap, dance, fall, getUp/stand, sit, point/present (at:[x,y]), wave, reactSurprise, cheer, laugh, stumble, face/turn (facing:1 or -1), talkGestures (line index), expression (emotion). Supported emotions: neutral, talk, happy, bigsmile, worried, strain, surprised, proud, sad, crying, angry, fear, confused, wink, focused. Use expression events to match story reactions; use pickUp then carry then drop/throw for object handling. Actions can overlap across different characters so they react to one another. Each action has t0 and optional dur (scene-relative seconds).
- ACTION DISCIPLINE: choose movement based on the actual scene, not a rigid quota. A motion concept should be demonstrated with visible movement when useful, but do not force a walk/run into every scene. For a solo demonstration, use one character. For dialogue, stage only the speakers and any relevant observers. Use point/present for diagrams, but let the character return to a neutral upright pose afterwards.
- INTERACTION actions (Phase C — use to make characters react to each other): approach(target, dur), retreat(target, dur), faceToward(target), leanIn(target, dur), recoil(target, dur). Example: characters discussing friction → ben 'leanIn' maya → maya 'recoil' → both reactSurprise. Use 'approach' before dialogue when a character needs to close distance.
- camera intents ONLY: establish (optional scale ~1.5-1.9, drift), focus (point:[x,y], scale ~2.4-3.2), follow (target: cast id), twoShot (targets:[idA,idB]), shake (at, amp). Add "at" (seconds) and "dur". A scene without camera gets a plain establishing shot.
- props ONLY: box (x, optional w/h ~40-80, optional moving:{from,to,t0,t1}), easel, lamppost, bench, plant — each with an id and numeric x. Repeat the props a scene needs in every scene that uses them (props do not carry over between scenes).
- overlays (scene-relative seconds, t0<t1): title {text, sub?}, formula {text} (plain ASCII math only: + - = ^ mu x N; keep formulas 3-12 chars, use standard symbols like v = d/t or F = ma; do NOT write half-formulas or bare fractions), arrows {arrows:[{from:[x,y],to:[x,y],color:"#hex",label}]}. Overlays are the main teaching surface — put the key term, formula or diagram label on screen while the narrator explains it.
- Narrative arc: scene 1 hooks with the characters' goal, middle scenes dramatise the concept (failure first, then the fix), final scene recaps the rule with a formula/title overlay and ends with a character cheering.
- Numbers: keep the total video under 100 seconds.

EXAMPLE (shape only — write ORIGINAL content for the topic, do not copy this story):
${SCHEMA_EXAMPLE}

Return strict JSON: {"script": <SceneScript>}. The JSON must be complete and parseable — no comments, no trailing commas, no ellipses.`;
}
