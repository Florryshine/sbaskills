import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/cartoon/server/admin";
import { generateStoryboard, validateStoryboard, type KALike } from "@/cartoon/server/storyboard";
import { narrateProjectScenes } from "@/cartoon/server/pipeline";

export const maxDuration = 60;

// Regenerate ONE scene: fresh LLM pass for that scene only, then re-narrate it.
// Other scenes (and their narration/audio files) are untouched.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await ctx.params;
  const project = await db.cartoonProject.findUnique({ where: { id }, include: { knowledgeAsset: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project.spec) return NextResponse.json({ error: "No script to regenerate from" }, { status: 400 });
  if (project.status === "rendering") return NextResponse.json({ error: "Cannot regenerate while rendering." }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const sceneId: string = body.sceneId;
  const spec = JSON.parse(project.spec);
  const scene = spec.scenes.find((s: { id: string }) => s.id === sceneId);
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  // focused LLM pass: same KA context, only this scene
  const ka: KALike = project.knowledgeAsset
    ? {
        keyword: project.knowledgeAsset.keyword, subject: project.knowledgeAsset.subject,
        summary: project.knowledgeAsset.summary, subTopics: project.knowledgeAsset.subTopics,
        keyConcepts: project.knowledgeAsset.keyConcepts, definitions: project.knowledgeAsset.definitions,
        facts: project.knowledgeAsset.facts,
      }
    : { keyword: project.customTopic || project.title, subject: "General", summary: project.customTopic || project.title };

  const instruction = typeof body.instruction === "string" && body.instruction.trim()
    ? `\n\nSPECIAL CREATIVE DIRECTION for this scene: ${body.instruction.trim().slice(0, 200)}`
    : "";
  const singlePrompt = `Rewrite ONE scene of the cartoon "${spec.title}" (topic: ${ka.keyword}).
Current scene JSON:
${JSON.stringify(scene, null, 1)}
Available characters: ${spec.characters.map((c: { ref: string; name: string }) => `${c.ref}=${c.name}`).join(", ")}.
Keep the same scene id ("${sceneId}") but you may change heading, narration (12-26 words), visualConcept, cast actions/expressions/positions, props, camera, transition, onScreenText.${instruction}

OUTPUT: ONLY the raw JSON object for this ONE scene in the same shape.`;

  try {
    const { generateJson } = await import("@/cartoon/server/zai");
    const { ACTIONS, EXPRESSIONS, VISUAL_CONCEPTS, SCENE_LAYOUTS, PROP_KINDS } = await import("@/cartoon/engine/types");
    const { CHARACTER_PRESETS } = await import("@/cartoon/engine/characters/presets");
    const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const pick = <T,>(v: unknown, allowed: readonly T[], fallback: T): T =>
      (typeof v === "string" && (allowed as readonly string[]).includes(v)) ? (v as T) : fallback;
    const num = (v: unknown, f: number) => { const n = typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : f; };

    const rawScene = await generateJson({
      prompt: singlePrompt,
      system: "You are a cartoon storyboard JSON generator. Reply with ONLY the raw JSON scene object.",
      validate: (v: unknown) => {
        const sc = v as Record<string, unknown>;
        if (!sc || typeof sc !== "object") throw new Error("not an object");
        const castIn = Array.isArray(sc.cast) ? sc.cast : [];
        const cast = castIn.slice(0, 3).map((m, j) => {
          const mm = (m || {}) as Record<string, unknown>;
          const ref = typeof mm.ref === "string" && spec.characters.some((c: { ref: string }) => c.ref === mm.ref) ? mm.ref : spec.characters[0].ref;
          return {
            ref, action: pick(mm.action, ACTIONS, "talk"), expression: pick(mm.expression, EXPRESSIONS, "happy"),
            x: clamp(num(mm.x, 400), 130, 870), y: clamp(num(mm.y, 812), 560, 860),
            scale: clamp(num(mm.scale, 1), 0.55, 1.5), speaking: j === 0 ? true : mm.speaking === true,
          };
        });
        if (cast.length === 0) throw new Error("scene has no cast");
        const props = (Array.isArray(sc.props) ? sc.props : []).slice(0, 3).map((p) => {
          const pp = (p || {}) as Record<string, unknown>;
          let kind = pick(pp.kind, PROP_KINDS, "book");
          if (kind === "chair") kind = "book";
          return { kind, x: clamp(num(pp.x, 180), 60, 940), y: clamp(num(pp.y, 640), 80, 900), scale: clamp(num(pp.scale, 0.8), 0.35, 1.8), popAt: clamp(num(pp.popAt, 0), 0, 30) };
        });
        return {
          id: sceneId,
          heading: typeof sc.heading === "string" && sc.heading.trim() ? sc.heading.trim().slice(0, 24) : scene.heading,
          narration: typeof sc.narration === "string" && sc.narration.trim() ? sc.narration.trim().replace(/\s+/g, " ").slice(0, 260) : scene.narration,
          visualConcept: pick(sc.visualConcept, VISUAL_CONCEPTS, "abstract"),
          layout: pick(sc.layout, SCENE_LAYOUTS, "focus-center"),
          cast, props,
          camera: pick(sc.camera, ["none", "zoom-in", "zoom-out", "pan-left", "pan-right"] as const, "zoom-in"),
          transition: pick(sc.transition, ["fade", "slide", "wipe", "iris", "none"] as const, "fade"),
          onScreenText: typeof sc.onScreenText === "string" && sc.onScreenText.trim() ? sc.onScreenText.trim().slice(0, 60) : undefined,
        };
      },
      attempts: 2,
    });

    // replace scene in spec
    const newScenes = spec.scenes.map((s: unknown) => ((s as { id: string }).id === sceneId ? rawScene : s));
    const newSpec = { ...spec, scenes: newScenes };
    const validated = validateStoryboard(newSpec, ka, project.customTopic || undefined);
    await db.cartoonProject.update({
      where: { id },
      data: { spec: JSON.stringify(validated), rawScript: JSON.stringify(validated) },
    });

    // re-narrate just this scene (unless text unchanged)
    const narration = project.narration ? JSON.parse(project.narration) : {};
    const old = narration[sceneId];
    const textChanged = !old || !project.spec?.includes(rawScene.narration);
    if (textChanged) {
      await narrateProjectScenes(id, [sceneId]);
    }
    return NextResponse.json({ ok: true, scene: rawScene, renarrated: textChanged });
  } catch (e) {
    return NextResponse.json({ error: `Scene regeneration failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` }, { status: 500 });
  }
}
