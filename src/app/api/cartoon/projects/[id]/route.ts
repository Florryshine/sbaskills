import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/cartoon/server/admin";
import { validateStoryboard } from "@/cartoon/server/storyboard";
import { startRender } from "@/cartoon/server/pipeline";

export const maxDuration = 60;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await ctx.params;
  const project = await db.cartoonProject.findUnique({
    where: { id },
    include: { knowledgeAsset: { select: { keyword: true, subject: true, summary: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    project: {
      ...project,
      spec: project.spec ? JSON.parse(project.spec) : null,
      narration: project.narration ? JSON.parse(project.narration) : {},
    },
  });
}

// Edit the spec: script text, scene composition, cast, orientation...
// Every edit is re-validated against the engine catalog.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await ctx.params;
  const project = await db.cartoonProject.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.action === "render") {
    const r = await startRender(id);
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  }

  if (body.orientation && ["9:16", "16:9", "1:1"].includes(body.orientation)) {
    data.orientation = body.orientation;
  }
  if (typeof body.subtitles === "boolean") {
    data.subtitles = body.subtitles;
  }

  if (body.spec) {
    if (project.status === "rendering") {
      return NextResponse.json({ error: "Cannot edit while rendering. Wait for the render to finish or fail." }, { status: 409 });
    }
    try {
      const pseudoKa = {
        keyword: project.knowledgeAssetId ? (await db.knowledgeAsset.findUnique({ where: { id: project.knowledgeAssetId } }))?.keyword || "topic" : project.customTopic || project.title,
        subject: "General",
        summary: "",
      };
      const validated = validateStoryboard(body.spec, pseudoKa, project.customTopic || undefined);
      data.spec = JSON.stringify(validated);
      data.rawScript = JSON.stringify(validated);
      if (validated.title) data.title = validated.title.slice(0, 90);
    } catch (e) {
      return NextResponse.json({ error: `Invalid storyboard: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
    }
  }

  delete data.stageMessage; // stageMessage managed by pipeline only
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true, updated: 0 });

  const updated = await db.cartoonProject.update({ where: { id }, data });
  return NextResponse.json({ ok: true, updated: 1, title: updated.title });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await ctx.params;
  const project = await db.cartoonProject.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.status === "rendering") {
    return NextResponse.json({ error: "Cannot delete while rendering." }, { status: 409 });
  }
  // cascade content assets
  const assets = await db.contentAsset.findMany({ where: { projectId: id } });
  for (const a of assets) {
    await db.contentAsset.delete({ where: { id: a.id } });
  }
  await db.cartoonProject.delete({ where: { id } });
  // clean media
  const fs = await import("fs");
  const path = await import("path");
  fs.rmSync(path.join(process.cwd(), "media", "cartoon-audio", id), { recursive: true, force: true });
  fs.rmSync(path.join(process.cwd(), "media", "cartoon-videos", `${id}.mp4`), { force: true });
  return NextResponse.json({ ok: true });
}
