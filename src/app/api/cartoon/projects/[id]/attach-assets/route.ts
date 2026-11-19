// POST /api/cartoon/projects/[id]/attach-assets
// Manual Shared Visual Asset Library control per scene (studio step C).
//   { sceneId, auto: true }                    → re-run discovery for ONE scene
//   { sceneId, assetIds: ["..."], clear? }     → attach library assets manually
//   { sceneId, removeAssetIds: ["..."] }       → detach specific assets
//   { sceneId, clear: true }                   → detach everything from the scene
// Attached assets carry their licence into the spec (attribution safety).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/cartoon/server/admin";
import { db } from "@/lib/db";
import { getAsset, bumpUsage } from "@/assets/server/library";
import { discoverAsset } from "@/assets/server/discovery";
import { assetFileExists } from "@/assets/server/storage";
import type { Storyboard, SceneAssetProp } from "@/cartoon/engine/types";

const LAYOUT_SLOTS: Record<string, Array<{ x: number; y: number }>> = {
  "focus-left": [{ x: 800, y: 250 }, { x: 830, y: 620 }],
  "focus-right": [{ x: 200, y: 250 }, { x: 170, y: 620 }],
  "focus-center": [{ x: 160, y: 280 }, { x: 840, y: 660 }],
  split: [{ x: 210, y: 230 }, { x: 790, y: 660 }],
  journey: [{ x: 500, y: 190 }, { x: 780, y: 320 }],
  diagram: [{ x: 500, y: 640 }, { x: 170, y: 260 }],
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await params;
  try {
    const body = await req.json() as {
      sceneId?: string; auto?: boolean; assetIds?: string[]; removeAssetIds?: string[];
      clear?: boolean;
    };
    if (!body.sceneId) return NextResponse.json({ error: "sceneId is required" }, { status: 400 });

    const project = await db.cartoonProject.findUnique({ where: { id } });
    if (!project || !project.spec) return NextResponse.json({ error: "project has no spec" }, { status: 404 });
    const spec = JSON.parse(project.spec) as Storyboard;
    const scene = spec.scenes.find((s) => s.id === body.sceneId);
    if (!scene) return NextResponse.json({ error: "scene not found" }, { status: 404 });

    let assets: SceneAssetProp[] = scene.customAssets ? [...scene.customAssets] : [];

    if (body.clear) {
      assets = [];
    }
    if (Array.isArray(body.removeAssetIds) && body.removeAssetIds.length) {
      assets = assets.filter((a) => !body.removeAssetIds!.includes(a.assetId));
    }
    if (Array.isArray(body.assetIds) && body.assetIds.length) {
      // manual attach: resolve current URLs from the library (never trust input)
      const existing = new Set(assets.map((a) => a.assetId));
      const slots = LAYOUT_SLOTS[scene.layout] || LAYOUT_SLOTS["focus-center"];
      for (const assetId of body.assetIds.slice(0, 4)) {
        if (existing.has(assetId)) continue;
        const asset = await getAsset(assetId);
        if (!asset || !assetFileExists(asset.filePath)) continue;
        const slot = slots[assets.length % slots.length];
        assets.push({
          assetId: asset.id, url: asset.publicUrl,
          x: slot.x, y: slot.y, scale: 1, popAt: 0.3 + assets.length * 0.25,
          name: asset.name, license: asset.license,
        });
        void bumpUsage(asset.id);
      }
    }
    if (body.auto) {
      // discovery for one scene: reuse library, else generate catalog SVG
      const res = await discoverAsset({
        topic: scene.heading || scene.narration.slice(0, 60),
        subject: project.knowledgeAssetId
          ? (await db.cartoonProject.findUnique({ where: { id }, include: { knowledgeAsset: true } }))?.knowledgeAsset?.subject
          : "General",
        keywords: scene.narration.split(/\s+/).filter((w) => w.length > 4).slice(0, 8),
        category: ({ classroom: "object", park: "plant", city: "object", bloodstream: "cell",
          "leaf-world": "plant", "chemistry-lab": "science-object", space: "science-object",
          "water-cycle": "diagram", ocean: "animal", farm: "animal", stage: "object",
          abstract: "object" } as Record<string, string>)[scene.visualConcept],
        allowGenerate: true, allowLlm: false, allowStock: false,
      });
      if (res.asset && !assets.some((a) => a.assetId === res.asset!.id)) {
        const slots = LAYOUT_SLOTS[scene.layout] || LAYOUT_SLOTS["focus-center"];
        const slot = slots[assets.length % slots.length];
        assets.push({
          assetId: res.asset.id, url: res.asset.publicUrl,
          x: slot.x, y: slot.y, scale: 1, popAt: 0.35,
          name: res.asset.name, license: res.asset.license,
        });
        void bumpUsage(res.asset.id);
      }
    }

    assets = assets.slice(0, 4);
    scene.customAssets = assets;
    await db.cartoonProject.update({ where: { id }, data: { spec: JSON.stringify(spec) } });
    return NextResponse.json({ ok: true, sceneAssets: assets, spec });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "attach failed" }, { status: 500 });
  }
}
