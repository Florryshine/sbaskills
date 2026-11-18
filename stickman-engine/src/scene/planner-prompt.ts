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

export function buildPlannerPrompt(topic: string, subject: string, kaSource = ''): string {
  const source = kaSource
    ? `\n\nSOURCE OF TRUTH (teaching material for "${topic}" — ground every fact in it, do not invent facts, statistics or names):\n"""\n${kaSource.slice(0, 6000)}\n"""\n`
    : `\nYou are creating an original short educational story. Teach only well-established facts about "${topic}".\n`;

  return `You are the head writer of an animated educational series for Nigerian secondary-school students (JAMB/WAEC level) at Shiney Brain Academy. Write a Stickman SceneScript: a JSON document that a deterministic animation compiler turns into a cartoon where simple 2D stick characters walk, push boxes, point at things and talk.

TOPIC: ${topic}
SUBJECT: ${subject}
${subjectRules(subject)}${source}

OUTPUT FORMAT — return STRICT JSON, no markdown fences, exactly this shape:
{"script": { ...SceneScript below... }}

SCENESCRIPT RULES (the validator rejects anything else):
- title: short video title (max 80 chars), NOT the topic restated verbatim. Make it story-flavoured, e.g. "Ben and the Stubborn Box".
- environment (top-level): one of {"type":"street","seed":<int>,"time":"day"} | {"type":"abstract","seed":<int>,"accent":"#2285b7"} | {"type":"classroom","seed":<int>}. The same environment should repeat across scenes unless the story changes world (a scene may override with "env").
- cast: 1-2 characters. Styles: "ben" (orange hoodie), "maya" (blue hoodie), "prof" (classic black). Example: {"ben":{"style":"ben"},"maya":{"style":"maya"}}.
- scenes: 4-8 scenes, each 4-10 seconds. Give each scene a unique id like "s1-hook".
- Every scene with characters positions them in its "cast" map with a numeric starting x (world units; keep x between -400 and 500) and optional facing (1 right, -1 left).
- dialogue: who is a cast id or "narr" (narrator). 1-3 lines per scene, each under 220 characters, natural spoken English, exam-relevant, NEVER markdown. Line "t0" (scene-relative seconds) is optional; lines without t0 play one after another with a 0.4s gap starting at 0.35s.
- actions use ONLY these verbs: walk (needs from,to; optional speed ~80-320), run (needs from,to), push (optional prop id; use prop:"box" when a box exists), point/present (needs at:[x,y] world position), wave, reactSurprise, cheer, laugh, stumble, sit, face (needs facing:1 or -1), talkGestures (optional line:<dialogue index>, stressEvery:<int>). Each action has t0 (scene-relative seconds).
- camera intents ONLY: establish (optional scale ~1.5-1.9, drift), focus (point:[x,y], scale ~2.4-3.2), follow (target: cast id), twoShot (targets:[idA,idB]), shake (at, amp). Add "at" (seconds) and "dur". A scene without camera gets a plain establishing shot.
- props ONLY: box (x, optional w/h ~40-80, optional moving:{from,to,t0,t1}), easel, lamppost, bench, plant — each with an id and numeric x. Repeat the props a scene needs in every scene that uses them (props do not carry over between scenes).
- overlays (scene-relative seconds, t0<t1): title {text, sub?}, formula {text} (plain ASCII math only: + - = ^ mu x N), arrows {arrows:[{from:[x,y],to:[x,y],color:"#hex",label}]}. Overlays are the main teaching surface — put the key term, formula or diagram label on screen while the narrator explains it.
- Narrative arc: scene 1 hooks with the characters' goal, middle scenes dramatise the concept (failure first, then the fix), final scene recaps the rule with a formula/title overlay and ends with a character cheering.
- Numbers: keep the total video under 100 seconds.

EXAMPLE (shape only — write ORIGINAL content for the topic, do not copy this story):
${SCHEMA_EXAMPLE}

Return strict JSON: {"script": <SceneScript>}. The JSON must be complete and parseable — no comments, no trailing commas, no ellipses.`;
}
