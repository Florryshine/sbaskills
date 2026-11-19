import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/cartoon/server/admin";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

// Stream rendered cartoon videos: /api/cartoon/video/<projectId>.mp4
export async function GET(_req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { file } = await ctx.params;
  if (!/^[a-z0-9]+\.mp4$/i.test(file)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const p = path.join(process.cwd(), "media", "cartoon-videos", file);
  if (!fs.existsSync(p)) return NextResponse.json({ error: "Video not found — it may still be rendering." }, { status: 404 });
  const stat = fs.statSync(p);
  const size = stat.size;
  const range = _req.headers.get("range");
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : size - 1;
      const chunk = Buffer.alloc(end - start + 1);
      const fd = fs.openSync(p, "r");
      fs.readSync(fd, chunk, 0, chunk.length, start);
      fs.closeSync(fd);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.length),
        },
      });
    }
  }
  const buf = fs.readFileSync(p);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
