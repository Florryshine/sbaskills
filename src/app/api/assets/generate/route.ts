// GET  /api/assets/generate — list the built-in generation catalog (grouped)
// POST /api/assets/generate — generate an SVG asset
//   mode "catalog": { key }                        → regenerate a catalog asset
//   mode "llm":     { prompt, subject?, category?} → AI-generated illustration
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/cartoon/server/admin";
import { ASSET_CATALOG } from "@/assets/svg/catalog";
import { createAsset, getAsset } from "@/assets/server/library";
import { generateAndStoreSvg } from "@/assets/server/svgLlm";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const items = ASSET_CATALOG.map(({ key, name, subject, category, keywords, description, w, h }) =>
    ({ key, name, subject, category, keywords, description, w, h }));
  return NextResponse.json({ catalog: items });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  try {
    const body = await req.json() as {
      mode?: "catalog" | "llm"; key?: string; prompt?: string;
      name?: string; subject?: string; category?: string;
    };

    if (body.mode === "llm") {
      if (!body.prompt?.trim()) return NextResponse.json({ error: "prompt is required" }, { status: 400 });
      const g = await generateAndStoreSvg({
        prompt: body.prompt.trim().slice(0, 400),
        name: body.name || body.prompt.trim().slice(0, 60),
        subject: body.subject,
        category: body.category,
      });
      const asset = await getAsset(g.assetId);
      return NextResponse.json({ asset, duplicate: g.duplicate, mode: "llm" }, { status: g.duplicate ? 200 : 201 });
    }

    // catalog mode
    const entry = ASSET_CATALOG.find((c) => c.key === body.key);
    if (!entry) return NextResponse.json({ error: "unknown catalog key" }, { status: 400 });
    const created = await createAsset({
      name: body.name || entry.name,
      description: entry.description,
      subject: body.subject || entry.subject,
      category: body.category || entry.category,
      keywords: [entry.name, entry.key.replace(/-/g, " "), ...entry.keywords],
      data: Buffer.from(entry.gen(), "utf8"),
      ext: "svg",
      source: "catalog",
      sourceRef: entry.key,
      license: "SBA Original (CC0)",
      attribution: "Shiney Brain Academy — original artwork",
      generationParams: { catalogKey: entry.key, generator: "builtin" },
    });
    return NextResponse.json({ asset: created.asset, duplicate: created.duplicate, mode: "catalog" },
      { status: created.duplicate ? 200 : 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "generation failed" }, { status: 500 });
  }
}
