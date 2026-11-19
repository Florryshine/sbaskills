import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/cartoon/server/admin";
import { narrateProjectScenes } from "@/cartoon/server/pipeline";

export const maxDuration = 60;

// Re-narrate: body { sceneId?: string } — one scene, or all scenes if omitted.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await ctx.params;
  const project = await db.cartoonProject.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project.spec) return NextResponse.json({ error: "No script yet" }, { status: 400 });
  if (project.status === "rendering") return NextResponse.json({ error: "Cannot re-narrate while rendering." }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const spec = JSON.parse(project.spec);
  const sceneIds: string[] = body.sceneId
    ? [String(body.sceneId)]
    : spec.scenes.map((s: { id: string }) => s.id);

  await db.cartoonProject.update({ where: { id }, data: { status: "narrating", stage: "narration" } });
  try {
    await narrateProjectScenes(id, sceneIds);
    await db.cartoonProject.update({ where: { id }, data: { status: "cast_ready", progress: 1, stage: "done", stageMessage: "Narration updated." } });
    return NextResponse.json({ ok: true, narrated: sceneIds.length });
  } catch (e) {
    // Reset the stage too — leaving stage:"narration" here stranded projects
    // in a fake "Narrating..." state even though the previous audio is intact.
    await db.cartoonProject.update({ where: { id }, data: { status: "cast_ready", stage: "done", stageMessage: `Narration failed: ${e instanceof Error ? e.message.slice(0, 120) : "error"}` } });
    return NextResponse.json({ error: `Narration failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` }, { status: 500 });
  }
}
