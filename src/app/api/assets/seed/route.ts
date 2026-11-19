// POST /api/assets/seed — (re)seed the built-in SVG catalog into the library.
// Idempotent: identical content is deduped by hash, so this never stores
// duplicates. Useful after adding new generators.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/cartoon/server/admin";
import { ensureCatalogSeeded } from "@/assets/server/library";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  try {
    const force = req.nextUrl.searchParams.get("force") === "1";
    const r = await ensureCatalogSeeded(force);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "seed failed" }, { status: 500 });
  }
}
