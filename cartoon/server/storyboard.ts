// Storyboard generation: KA -> validated CartoonSpec (the production master).
// The LLM decides the creative composition (characters, worlds, actions,
// camera) but every value is validated and clamped against the engine
// catalog so the renderer can NEVER receive something it cannot draw.
import type {
  Storyboard, StoryboardScene, Action, Expression, VisualConcept,
  SceneLayout, PropKind, CameraMove, Transition, CharacterDNA, SceneAssetProp,
} from "../engine/types";
import {
  ACTIONS, EXPRESSIONS, VISUAL_CONCEPTS, SCENE_LAYOUTS, PROP_KINDS, CONCEPT_LABELS,
} from "../engine/types";
import { CHARACTER_PRESETS } from "../engine/characters/presets";
import { generateWithFallback } from "../../lib/llmFallbackChain";
import { parseJsonFromText } from "../../lib/robustJsonParse";

export interface KALike {
  keyword: string; subject: string; summary: string;
  subTopics?: string; keyConcepts?: string; definitions?: string; facts?: string;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const pick = <T,>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof v === "string" && (allowed as readonly string[]).includes(v)) ? (v as T) : fallback;

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

const ACTION_HINTS: Record<Action, string> = {
  idle: "standing, gentle breathing",
  talk: "talking with gestures",
  walk: "walking",
  run: "running fast",
  jump: "jumping",
  dance: "dancing joyfully",
  point: "pointing at something",
  wave: "waving hello/goodbye",
  sit: "sitting on a chair",
  think: "hand on chin, thinking",
  cheer: "arms up cheering",
  shrug: "shrugging",
};

const CONCEPT_HINTS: Record<VisualConcept, string> = {
  classroom: "classroom with blackboard",
  park: "sunny park with trees",
  city: "city street at dusk",
  bloodstream: "INSIDE a blood vessel with flowing red blood cells",
  "leaf-world": "INSIDE a plant leaf with chloroplasts and oxygen bubbles",
  "chemistry-lab": "chemistry lab with flasks and molecules",
  space: "outer space with planets and stars",
  "water-cycle": "mountain, rain cloud and sea",
  ocean: "under the ocean with fish",
  farm: "farm with crops and barn",
  stage: "presentation stage with curtains and spotlights",
  abstract: "colourful abstract shapes world",
};

export function buildPrompt(ka: KALike, customTopic?: string, targetDurationSeconds = 120): string {
  const topic = customTopic || ka.keyword;
  const sceneCount = Math.max(7, Math.min(9, Math.ceil(targetDurationSeconds / 45)));
  const wordsPerScene = Math.max(25, Math.round(targetDurationSeconds * 2.55 / sceneCount));
  let sub = "";
  try { sub = (JSON.parse(ka.subTopics || "[]") as { title: string; explanation: string }[]).slice(0, 6).map((s) => `- ${s.title}: ${s.explanation}`).join("\n"); } catch { /* ignore */ }
  let facts = "";
  try { facts = (JSON.parse(ka.facts || "[]") as string[]).slice(0, 5).map((f) => `- ${f}`).join("\n"); } catch { /* ignore */ }
  let concepts = "";
  try { concepts = (JSON.parse(ka.keyConcepts || "[]") as string[]).slice(0, 8).join(", "); } catch { /* ignore */ }

  const presets = Object.entries(CHARACTER_PRESETS).map(([k, v]) => `${k} (${v.name})`).join(", ");

  return `You are the creative director of an educational cartoon series for Shiney Brain Academy (Nigerian exam prep, JAMB/WAEC/NECO). Design a cartoon storyboard that teaches: "${topic}" (subject: ${ka.subject}).

KNOWLEDGE (source of truth):
Summary: ${ka.summary.slice(0, 900)}
Sub-topics:
${sub || "- (use summary)"}
Key concepts: ${concepts}
Amazing facts:
${facts || "- (invent none, stay on topic)"}

STORY RULES:
- Target finished video duration: approximately ${targetDurationSeconds} seconds. Create exactly ${sceneCount} scenes: an exciting hook, a logical step-by-step explanation with at least one journey scene, a useful recap and a fun ending.
- Narration: warm, playful Nigerian-friendly English, approximately ${wordsPerScene} words per scene. For longer videos, expand the mechanism, examples and implications without filler or repetition. One clear idea per scene.
- 1-3 characters per scene. Available preset characters: ${presets}. Give them actions and expressions that match the story (examples: hook=wave+excited, journey=run+surprised, recap=point+proud, ending=cheer+happy).
- onScreenText: optional short spoken-style text shown in a speech bubble above ONE speaking character (max 6 words). Omit for most scenes.
- Choose visualConcept from exactly: ${VISUAL_CONCEPTS.map((c) => `${c} = ${CONCEPT_HINTS[c]}`).join("; ")}.
- props: 0-3 per scene from exactly: ${PROP_KINDS.join(", ")}. Use props that support the lesson (heart for circulation, leaf for photosynthesis, flask/molecule for chemistry...). Do NOT use chair unless a character sits (the engine places chairs automatically).
- camera: one of none, zoom-in, zoom-out, pan-left, pan-right. transition: one of fade, slide, wipe, iris.
- Positions: x is 0-1000 across the width, y is 0-1000 where y is where the character's FEET stand (ground is usually 780-840). Keep characters inside x=150..850. scale 0.6-1.4 (1.0 default).
- music: "happy" for upbeat topics, "curious" for discovery, "calm" for gentle ones.

OUTPUT: ONLY raw JSON exactly in this shape (no markdown, no comments):
{
  "title": "fun video title (max 60 chars)",
  "description": "1-2 sentence description",
  "caption": "social media caption with a hook (max 200 chars)",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4"],
  "music": "happy|calm|curious",
  "characters": [{ "ref": "a", "name": "Tobi", "presetKey": "tobi" }],
  "scenes": [{
    "id": "s1", "heading": "max 22 chars", "narration": "12-26 words",
    "visualConcept": "park", "layout": "focus-center|focus-left|focus-right|split|journey|diagram",
    "cast": [{ "ref": "a", "action": "wave", "expression": "excited", "x": 500, "y": 810, "scale": 1.1, "speaking": true }],
    "props": [{ "kind": "book", "x": 250, "y": 700, "scale": 0.8, "popAt": 0 }],
    "camera": "zoom-in", "transition": "fade", "onScreenText": "Hi friends!"
  }, ... 7 scenes total]
}
Every cast ref MUST exist in characters. Use only the listed enum values. Every scene MUST have at least one cast member.`;
}

export function buildSystem(): string {
  return `You are a storyboard JSON generator for a cartoon video engine. You reply with ONLY valid raw JSON matching the requested schema. No explanations, no markdown.`;
}

// ---- validation / clamping ----
export function validateStoryboard(raw: unknown, ka: KALike, customTopic?: string): Storyboard {
  if (!raw || typeof raw !== "object") throw new Error("storyboard is not an object");
  const o = raw as Record<string, unknown>;
  const charsIn = Array.isArray(o.characters) ? o.characters : [];
  const characters: Storyboard["characters"] = [];
  const refSet = new Set<string>();
  const presetKeys = Object.keys(CHARACTER_PRESETS);
  charsIn.slice(0, 4).forEach((c, i) => {
    const cc = (c || {}) as Record<string, unknown>;
    let ref = typeof cc.ref === "string" && cc.ref.trim() ? cc.ref.trim().slice(0, 12) : `c${i}`;
    while (refSet.has(ref)) ref = ref + i;
    refSet.add(ref);
    const presetKey = presetKeys.includes(String(cc.presetKey)) ? String(cc.presetKey) : presetKeys[i % presetKeys.length];
    const name = typeof cc.name === "string" && cc.name.trim() ? cc.name.trim().slice(0, 20) : CHARACTER_PRESETS[presetKey].name;
    characters.push({ ref, name, presetKey });
  });
  if (characters.length === 0) characters.push({ ref: "a", name: "Tobi", presetKey: "tobi" });

  const scenesIn = Array.isArray(o.scenes) ? o.scenes : [];
  if (scenesIn.length < 3) throw new Error(`not enough scenes (${scenesIn.length})`);
  const scenes: StoryboardScene[] = scenesIn.slice(0, 9).map((s, i) => {
    const sc = (s || {}) as Record<string, unknown>;
    const narration = typeof sc.narration === "string" && sc.narration.trim()
      ? sc.narration.trim().replace(/\s+/g, " ").slice(0, 1400)
      : `Let us learn something amazing about ${customTopic || ka.keyword}.`;
    const castIn = Array.isArray(sc.cast) ? sc.cast : [];
    const cast = castIn.slice(0, 3).map((m, j) => {
      const mm = (m || {}) as Record<string, unknown>;
      const ref = typeof mm.ref === "string" && refSet.has(mm.ref) ? mm.ref : characters[j % characters.length].ref;
      return {
        ref,
        action: pick(mm.action, ACTIONS, j === 0 ? "talk" : "idle") as Action,
        expression: pick(mm.expression, EXPRESSIONS, "happy") as Expression,
        x: clamp(num(mm.x, 320 + j * 260), 130, 870),
        y: clamp(num(mm.y, 812), 560, 860),
        scale: clamp(num(mm.scale, 1), 0.55, 1.5),
        speaking: j === 0 ? true : mm.speaking === true,
      };
    });
    if (cast.length === 0) {
      cast.push({ ref: characters[0].ref, action: "talk", expression: "happy", x: 400, y: 812, scale: 1, speaking: true });
    }
    const propsIn = Array.isArray(sc.props) ? sc.props : [];
    const props = propsIn.slice(0, 3).map((p) => {
      const pp = (p || {}) as Record<string, unknown>;
      let kind = pick(pp.kind, PROP_KINDS, "book") as PropKind;
      if (kind === "chair") kind = "book"; // chairs are auto-placed; avoid duplicates
      return {
        kind,
        x: clamp(num(pp.x, 180), 60, 940),
        y: clamp(num(pp.y, 640), 80, 900),
        scale: clamp(num(pp.scale, 0.8), 0.35, 1.8),
        popAt: clamp(num(pp.popAt, 0), 0, 30),
      };
    });
    // Shared Visual Asset Library placements are attached AFTER validation by
    // the pipeline / attach endpoint; if a stored spec re-enters validation
    // (spec edit) keep only structurally valid entries, clamped like props.
    const customAssets: SceneAssetProp[] = (Array.isArray(sc.customAssets) ? sc.customAssets : [])
      .slice(0, 4)
      .map((a) => {
        const aa = (a || {}) as Record<string, unknown>;
        if (typeof aa.assetId !== "string" || typeof aa.url !== "string") return null;
        if (!/^\/(visual-assets|api)\//.test(aa.url) && !/^https?:\/\//.test(aa.url)) return null;
        return {
          assetId: aa.assetId.slice(0, 40),
          url: aa.url.slice(0, 300),
          x: clamp(num(aa.x, 800), 40, 960),
          y: clamp(num(aa.y, 260), 40, 960),
          scale: clamp(num(aa.scale, 1), 0.3, 2.2),
          popAt: clamp(num(aa.popAt, 0), 0, 30),
          name: typeof aa.name === "string" ? aa.name.slice(0, 90) : undefined,
          license: typeof aa.license === "string" ? aa.license.slice(0, 120) : undefined,
        } satisfies SceneAssetProp;
      })
      .filter(Boolean) as SceneAssetProp[];
    return {
      id: typeof sc.id === "string" && sc.id.trim() ? sc.id.trim().slice(0, 16) : `s${i + 1}`,
      heading: typeof sc.heading === "string" && sc.heading.trim() ? sc.heading.trim().slice(0, 24) : `Scene ${i + 1}`,
      narration,
      visualConcept: pick(sc.visualConcept, VISUAL_CONCEPTS, "abstract") as VisualConcept,
      layout: pick(sc.layout, SCENE_LAYOUTS, "focus-center") as SceneLayout,
      cast,
      props,
      customAssets,
      camera: pick(sc.camera, ["none", "zoom-in", "zoom-out", "pan-left", "pan-right"] as const, "zoom-in") as CameraMove,
      transition: pick(sc.transition, ["fade", "slide", "wipe", "iris", "none"] as const, "fade") as Transition,
      onScreenText: typeof sc.onScreenText === "string" && sc.onScreenText.trim() ? sc.onScreenText.trim().slice(0, 60) : undefined,
    };
  });

  const hashtagsIn = Array.isArray(o.hashtags) ? o.hashtags : [];
  const hashtags = hashtagsIn.filter((h) => typeof h === "string").slice(0, 6).map((h) => (h.startsWith("#") ? h : `#${h}`));

  return {
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 70) : (customTopic || ka.keyword),
    description: typeof o.description === "string" ? o.description.trim().slice(0, 400) : "",
    caption: typeof o.caption === "string" && o.caption.trim() ? o.caption.trim().slice(0, 400) : `${customTopic || ka.keyword} — learn it the fun way with Shiney Brain Academy!`,
    hashtags: hashtags.length ? hashtags : ["#ShineyBrainAcademy", "#LearnWithFun", `#${(ka.subject || "Learning").replace(/\s+/g, "")}`],
    music: pick(o.music, ["happy", "calm", "curious"] as const, "happy"),
    characters,
    scenes,
  };
}

// deterministic fallback if the LLM is completely unavailable
export function fallbackStoryboard(ka: KALike, customTopic?: string): Storyboard {
  const topic = customTopic || ka.keyword;
  let subs: { title: string; explanation: string }[] = [];
  try { subs = JSON.parse(ka.subTopics || "[]").slice(0, 3); } catch { /* ignore */ }
  const scenes: StoryboardScene[] = [
    {
      id: "s1", heading: "Hello!", narration: `Hello friends! Today on Shiney Brain Academy we are exploring ${topic}, and it is going to be amazing.`,
      visualConcept: "park", layout: "focus-center",
      cast: [{ ref: "a", action: "wave", expression: "excited", x: 500, y: 815, scale: 1.15, speaking: true }],
      props: [{ kind: "sun", x: 130, y: 120, scale: 0.7 }],
      camera: "zoom-in", transition: "fade", onScreenText: "Hi friends!",
    },
    {
      id: "s2", heading: "Big Idea", narration: `Here is the big idea: ${ka.summary.split(".")[0]}. Keep watching, it gets even more interesting.`,
      visualConcept: "classroom", layout: "focus-left",
      cast: [
        { ref: "a", action: "sit", expression: "confused", x: 280, y: 810, scale: 0.85, speaking: false },
        { ref: "b", action: "point", expression: "happy", x: 660, y: 812, scale: 1.0, speaking: true },
      ],
      props: [],
      camera: "none", transition: "slide",
    },
  ];
  // teach scenes from sub-topics
  subs.forEach((sub, i) => {
    scenes.push({
      id: `t${i + 1}`, heading: sub.title.slice(0, 22),
      narration: sub.explanation.split(". ").slice(0, 2).join(". ").slice(0, 200) || sub.title,
      visualConcept: i === 0 ? "bloodstream" : i === 1 ? "chemistry-lab" : "abstract",
      layout: i === 0 ? "journey" : "focus-right",
      cast: [{ ref: "a", action: i === 0 ? "run" : "point", expression: i === 0 ? "surprised" : "proud", x: 420, y: 800, scale: i === 0 ? 0.8 : 1.05, speaking: true }],
      props: [{ kind: "bulb", x: 800, y: 300, scale: 0.6, popAt: 1 }],
      camera: "zoom-in", transition: i === 0 ? "wipe" : "fade",
    });
  });
  scenes.push({
    id: "end", heading: "Keep Learning!", narration: "Now you know the basics. Subscribe to Shiney Brain Academy and keep learning the fun way. See you soon!",
    visualConcept: "stage", layout: "focus-center",
    cast: [{ ref: "a", action: "cheer", expression: "happy", x: 480, y: 815, scale: 1.1, speaking: true }],
    props: [{ kind: "trophy", x: 200, y: 700, scale: 0.8 }],
    camera: "zoom-out", transition: "iris",
  });
  return {
    title: topic,
    description: ka.summary.slice(0, 200),
    caption: `${topic} explained the fun way! Follow Shiney Brain Academy for more.`,
    hashtags: ["#ShineyBrainAcademy", "#LearnWithFun", `#${(ka.subject || "Learning").replace(/\s+/g, "")}`, "#Education"],
    music: "curious",
    characters: [
      { ref: "a", name: "Tobi", presetKey: "tobi" },
      { ref: "b", name: "Ada", presetKey: "ada" },
    ],
    scenes,
  };
}

export async function generateStoryboard(ka: KALike, customTopic?: string, targetDurationSeconds = 120): Promise<{ spec: Storyboard; usedFallback: boolean; error?: string }> {
  const prompt = buildSystem() + "\\n\\n" + buildPrompt(ka, customTopic, targetDurationSeconds);
  const generated = await generateWithFallback(
    prompt,
    (text: string) => parseJsonFromText(text, "object"),
    (value: unknown) => {
      try { validateStoryboard(value, ka, customTopic); return true; }
      catch { return false; }
    },
    8192,
  );
  if (generated?.result) {
    return {
      spec: validateStoryboard(generated.result, ka, customTopic),
      usedFallback: false,
    };
  }
  const detail = generated?.errors?.slice(-3).join(" | ") || "All configured text providers failed validation.";
  return { spec: fallbackStoryboard(ka, customTopic), usedFallback: true, error: detail };
}
