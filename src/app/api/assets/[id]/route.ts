// GET    /api/assets/[id] — full asset detail
// PATCH  /api/assets/[id] — edit metadata / regenerate catalog SVG / mark used
// DELETE /api/assets/[id] — remove asset + file
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/cartoon/server/admin";
import { getAsset, updateAsset, deleteAsset, regenerateCatalogAsset, bumpUsage } from "@/assets/server/library";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) return NextResponse.json({ error: "asset not found" }, { status: 404 });
  return NextResponse.json({ asset });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await params;
  try {
    const body = await req.json() as {
      name?: string; description?: string; subject?: string; category?: string;
      keywords?: string[]; license?: string; licenseUrl?: string | null;
      attribution?: string | null; attributionRequired?: boolean; isActive?: boolean;
      action?: string; catalogKey?: string; use?: boolean;
    };
    if (body.action === "regenerate") {
      const asset = await regenerateCatalogAsset(id, body.catalogKey);
      if (!asset) return NextResponse.json({ error: "only catalog assets can be regenerated" }, { status: 400 });
      return NextResponse.json({ asset });
    }
    if (body.use) { await bumpUsage(id); }
    const asset = await updateAsset(id, body);
    if (!asset) return NextResponse.json({ error: "asset not found" }, { status: 404 });
    return NextResponse.json({ asset });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const { id } = await params;
  const ok = await deleteAsset(id);
  if (!ok) return NextResponse.json({ error: "asset not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
