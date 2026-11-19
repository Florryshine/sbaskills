import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/cartoon/server/admin";
import { runScriptPipeline } from "@/cartoon/server/pipeline";
import { deleteProjectAudio } from "@/cartoon/server/narration";

export const maxDuration = 60;

// Regenerate the WHOLE storyboard from the KA (fresh creative pass),
// replacing script + narration. Refuses while rendering.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await ctx.params;
  const project = await db.cartoonProject.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.status === "rendering") {
    return NextResponse.json({ error: "Cannot regenerate while rendering." }, { status: 409 });
  }
  await db.cartoonProject.update({
    where: { id },
    data: { status: "scripting", stage: "scripting", stageMessage: "Regenerating the storyboard from scratch...", progress: 0, error: null, attemptCount: 0 },
  });
  deleteProjectAudio(id);
  await db.cartoonProject.update({ where: { id }, data: { narration: null, videoPath: null, videoUrl: null, videoSizeBytes: null, durationSeconds: null } });
  void runScriptPipeline(id);
  return NextResponse.json({ ok: true, message: "Regenerating script and narration..." });
}
