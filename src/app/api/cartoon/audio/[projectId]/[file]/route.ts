import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/cartoon/server/admin";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

// Stream narration audio for the preview player.
// Security: file name is sanitised; projectId must be a cuid-like string.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectId: string; file: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { projectId, file } = await ctx.params;
  if (!/^[a-z0-9]+$/i.test(projectId) || !/^[a-z0-9_.-]+\.wav$/i.test(file)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const p = path.join(process.cwd(), "media", "cartoon-audio", projectId, file);
  if (!fs.existsSync(p)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const stat = fs.statSync(p);
  const buf = fs.readFileSync(p);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=86400",
      "Accept-Ranges": "bytes",
    },
  });
}
