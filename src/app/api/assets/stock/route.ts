// POST /api/assets/stock — search free providers / import a candidate
//   { action: "search", query, providers? }  → StockCandidate[]
//   { action: "import", candidate }          → VisualAsset (with licence metadata)
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/cartoon/server/admin";
import { searchStock, importStockCandidate, providerKeyStatus, type StockCandidate } from "@/assets/server/stock";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  return NextResponse.json({ providers: providerKeyStatus() });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  try {
    const body = await req.json() as {
      action?: "search" | "import"; query?: string; providers?: string[]; candidate?: StockCandidate;
    };

    if (body.action === "import") {
      if (!body.candidate?.fullUrl || !body.candidate?.provider) {
        return NextResponse.json({ error: "candidate with provider + fullUrl required" }, { status: 400 });
      }
      const imp = await importStockCandidate(body.candidate);
      return NextResponse.json(imp);
    }

    const query = (body.query || "").trim();
    if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });
    const result = await searchStock(query.slice(0, 200), body.providers);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "stock search failed" }, { status: 500 });
  }
}
