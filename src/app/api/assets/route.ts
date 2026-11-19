// GET  /api/assets  — search/list the shared visual asset library (+stats)
// POST /api/assets  — import an asset (upload data URL or remote URL)
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/cartoon/server/admin";
import { searchAssets, libraryStats, ensureCatalogSeeded, createAsset } from "@/assets/server/library";
import { providerKeyStatus } from "@/assets/server/stock";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  try {
    const sp = req.nextUrl.searchParams;
    // seeding the built-in catalog is idempotent + local; keeps the library
    // useful from the very first request without any manual step
    await ensureCatalogSeeded();
    const [assets, stats] = await Promise.all([
      searchAssets({
        q: sp.get("q") || undefined,
        subject: sp.get("subject") || undefined,
        category: sp.get("category") || undefined,
        assetType: sp.get("assetType") || undefined,
        source: sp.get("source") || undefined,
        limit: sp.get("limit") ? Number(sp.get("limit")) : 60,
      }),
      libraryStats(),
    ]);
    return NextResponse.json({ assets, stats, providers: providerKeyStatus() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "list failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  try {
    const body = await req.json() as {
      name?: string; description?: string; subject?: string; category?: string;
      keywords?: string[]; dataUrl?: string; url?: string;
      license?: string; licenseUrl?: string; attribution?: string; attributionRequired?: boolean;
      source?: string; assetType?: "svg" | "image" | "3d";
    };
    if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    let buf: Buffer | null = null;
    let ext = "png";
    let mime: string | undefined;
    if (body.dataUrl) {
      const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(body.dataUrl);
      if (!m) return NextResponse.json({ error: "invalid dataUrl" }, { status: 400 });
      mime = m[1];
      ext = mime === "image/svg+xml" ? "svg" : (mime.split("/")[1] || "bin");
      buf = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "utf8");
    } else if (body.url) {
      const res = await fetch(body.url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) return NextResponse.json({ error: `remote fetch failed: HTTP ${res.status}` }, { status: 400 });
      mime = res.headers.get("content-type")?.split(";")[0] || undefined;
      ext = mime === "image/svg+xml" ? "svg" : (mime?.split("/")[1] || "jpg");
      buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 15 * 1024 * 1024) return NextResponse.json({ error: "file too large (15 MB limit)" }, { status: 400 });
    } else {
      return NextResponse.json({ error: "provide dataUrl or url" }, { status: 400 });
    }
    if (!buf || buf.length < 32) return NextResponse.json({ error: "file looks empty" }, { status: 400 });

    const result = await createAsset({
      name: body.name,
      description: body.description,
      subject: body.subject,
      category: body.category,
      assetType: body.assetType ?? (ext === "svg" ? "svg" : "image"),
      keywords: body.keywords,
      data: buf, ext, mimeType: mime,
      source: body.source || "upload",
      license: body.license || "SBA Original (CC0)",
      licenseUrl: body.licenseUrl,
      attribution: body.attribution,
      attributionRequired: body.attributionRequired,
    });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "import failed" }, { status: 500 });
  }
}
