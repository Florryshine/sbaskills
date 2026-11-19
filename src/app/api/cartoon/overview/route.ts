import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/cartoon/server/admin";
import { recoverStaleRenders } from "@/cartoon/server/pipeline";

export const maxDuration = 60;

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  await recoverStaleRenders();
  const [kas, characters, channels] = await Promise.all([
    db.knowledgeAsset.findMany({ orderBy: { keyword: "asc" } }),
    db.cartoonCharacter.findMany({ orderBy: [{ isPreset: "desc" }, { name: "asc" }] }),
    db.socialChannel.findMany({ orderBy: { platform: "asc" } }),
  ]);
  return NextResponse.json({
    knowledgeAssets: kas.map((k) => ({
      id: k.id, keyword: k.keyword, subject: k.subject, summary: k.summary,
      subTopics: JSON.parse(k.subTopics || "[]"), keyConcepts: JSON.parse(k.keyConcepts || "[]"),
      facts: JSON.parse(k.facts || "[]"),
    })),
    characters: characters.map((c) => ({ id: c.id, name: c.name, presetKey: c.presetKey, isPreset: c.isPreset, dna: JSON.parse(c.dna) })),
    channels,
  });
}
