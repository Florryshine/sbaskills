// POST /api/assets/discover — intelligent asset discovery
// Library first → local SVG generation → stock retrieval → graceful fallback.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/cartoon/server/admin";
import { discoverAsset } from "@/assets/server/discovery";
import { bumpUsage } from "@/assets/server/library";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  try {
    const body = await req.json() as {
      topic?: string; subject?: string; keywords?: string[]; category?: string;
      allowGenerate?: boolean; allowLlm?: boolean; allowStock?: boolean; autoImportStock?: boolean;
      use?: boolean;
    };
    if (!body.topic?.trim()) return NextResponse.json({ error: "topic is required" }, { status: 400 });
    const result = await discoverAsset({
      topic: body.topic.trim().slice(0, 300),
      subject: body.subject,
      keywords: body.keywords,
      category: body.category,
      allowGenerate: body.allowGenerate,
      allowLlm: body.allowLlm,
      allowStock: body.allowStock,
      autoImportStock: body.autoImportStock,
    });
    if (result.asset && body.use) void bumpUsage(result.asset.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "discovery failed" }, { status: 500 });
  }
}
