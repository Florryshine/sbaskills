import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/cartoon/server/admin";
import { runScriptPipeline } from "@/cartoon/server/pipeline";

export const maxDuration = 60;

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const projects = await db.cartoonProject.findMany({
    orderBy: { createdAt: "desc" },
    include: { knowledgeAsset: { select: { keyword: true, subject: true } } },
    take: 60,
  });
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const knowledgeAssetId: string | null = body.knowledgeAssetId || null;
  const customTopic: string | null = (body.customTopic || "").trim() || null;
  const orientation: string = ["9:16", "16:9", "1:1"].includes(body.orientation) ? body.orientation : "9:16";
  const subtitles: boolean = body.subtitles !== false;

  if (!knowledgeAssetId && !customTopic) {
    return NextResponse.json({ error: "Select a Knowledge Asset or enter a custom topic." }, { status: 400 });
  }

  let ka = null;
  if (knowledgeAssetId) {
    ka = await db.knowledgeAsset.findUnique({ where: { id: knowledgeAssetId } });
    if (!ka) return NextResponse.json({ error: "Knowledge Asset not found" }, { status: 404 });
  }

  const title = customTopic || ka?.keyword || "Untitled Cartoon";
  const project = await db.cartoonProject.create({
    data: {
      title: `Cartoon: ${title}`.slice(0, 90),
      knowledgeAssetId: ka?.id || null,
      customTopic,
      orientation,
      status: "scripting",
      stage: "scripting",
      stageMessage: "Starting the cartoon pipeline...",
    },
  });

  // background pipeline (script -> narration)
  void runScriptPipeline(project.id);

  return NextResponse.json({ project: { id: project.id, title: project.title, status: project.status } }, { status: 201 });
}
