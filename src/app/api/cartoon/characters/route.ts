import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/cartoon/server/admin";
import { EXPRESSIONS } from "@/cartoon/engine/types";
import type { CharacterDNA } from "@/cartoon/engine/types";

export const maxDuration = 60;

const HAIR_STYLES = ["short-curls", "afro-puff", "braids", "buzz", "fade", "ponytail", "buns", "long", "headwrap"];
const OUTFITS = ["hoodie", "tshirt", "dress", "pinafore", "lab-coat", "sports", "shirt-trousers", "skirt-blouse"];

function sanitizeDna(input: unknown): CharacterDNA {
  const d = (input || {}) as Record<string, unknown>;
  const hex = (v: unknown, f: string) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : f);
  const r = (v: unknown, a: number, b: number, f: number) => {
    const n = typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : f;
  };
  return {
    skin: hex(d.skin, "#8a5a3b"),
    hairStyle: (HAIR_STYLES.includes(String(d.hairStyle)) ? String(d.hairStyle) : "short-curls") as CharacterDNA["hairStyle"],
    hairColor: hex(d.hairColor, "#171114"),
    wrapColor: hex(d.wrapColor, "#c25e8e"),
    outfit: (OUTFITS.includes(String(d.outfit)) ? String(d.outfit) : "hoodie") as CharacterDNA["outfit"],
    topColor: hex(d.topColor, "#1a73e8"),
    bottomColor: hex(d.bottomColor, "#2c3a4d"),
    shoeColor: hex(d.shoeColor, "#f5f5f0"),
    accentColor: hex(d.accentColor, "#FFCC00"),
    height: r(d.height, 0.88, 1.14, 1),
    headScale: r(d.headScale, 0.88, 1.18, 1),
    bodyWidth: r(d.bodyWidth, 0.82, 1.18, 1),
    glasses: d.glasses === true,
    earrings: d.earrings === true,
    freckles: d.freckles === true,
    blush: d.blush === true,
    voice: "tongtong",
  };
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const chars = await db.cartoonCharacter.findMany({ orderBy: [{ isPreset: "desc" }, { name: "asc" }] });
  return NextResponse.json({
    characters: chars.map((c) => ({ id: c.id, name: c.name, presetKey: c.presetKey, isPreset: c.isPreset, dna: JSON.parse(c.dna) })),
    expressions: EXPRESSIONS,
  });
}

// Create or update a custom character (presets are immutable).
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 24);
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const dna = sanitizeDna(body.dna);

  // update existing custom character?
  if (body.id && !String(body.id).startsWith("preset")) {
    const existing = await db.cartoonCharacter.findUnique({ where: { id: String(body.id) } });
    if (existing && !existing.isPreset) {
      const updated = await db.cartoonCharacter.update({
        where: { id: existing.id },
        data: { name, dna: JSON.stringify(dna) },
      });
      return NextResponse.json({ character: { id: updated.id, name: updated.name, presetKey: updated.presetKey, isPreset: false, dna } });
    }
  }

  const presetKey = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`;
  const created = await db.cartoonCharacter.create({
    data: { name, presetKey, dna: JSON.stringify(dna), isPreset: false },
  });
  return NextResponse.json({ character: { id: created.id, name: created.name, presetKey: created.presetKey, isPreset: false, dna } }, { status: 201 });
}
