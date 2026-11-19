// Smoke test for the Shared Visual Asset Library server layer.
// Run: bun scripts/test-asset-library.ts
import { ASSET_CATALOG } from "../src/assets/svg/catalog";
import { ensureCatalogSeeded, createAsset, searchAssets, libraryStats } from "../src/assets/server/library";
import { discoverAsset } from "../src/assets/server/discovery";
import { sanitizeSvg } from "../src/assets/server/svgLlm";

async function main() {
  console.log(`catalog entries: ${ASSET_CATALOG.length}`);
  const keys = new Set<string>();
  for (const c of ASSET_CATALOG) {
    if (keys.has(c.key)) throw new Error(`duplicate catalog key: ${c.key}`);
    keys.add(c.key);
    const svg = c.gen();
    if (!svg.startsWith("<svg") || !svg.includes("xmlns")) throw new Error(`bad svg for ${c.key}`);
    if (/<script|onload|javascript:/i.test(svg)) throw new Error(`unsafe svg for ${c.key}`);
  }
  console.log("all generators produce well-formed roots");

  // seed
  const seed1 = await ensureCatalogSeeded();
  console.log("seed pass 1:", JSON.stringify(seed1));
  const seed2 = await ensureCatalogSeeded();
  console.log("seed pass 2 (must be 0 created):", JSON.stringify(seed2));
  if (seed2.created !== 0) throw new Error("dedup failed on reseed");

  // search
  const heart = await searchAssets({ q: "heart", limit: 5 });
  console.log("search 'heart':", heart.map((a) => a.name));
  if (!heart.length) throw new Error("heart not found");

  // dedup on identical content
  const dup = await createAsset({
    name: "Copy of Human Heart", data: Buffer.from(ASSET_CATALOG[0].gen(), "utf8"), ext: "svg", source: "upload",
  });
  console.log("duplicate detection:", dup.duplicate, dup.duplicateOf?.name);

  // discovery — library hit
  const d1 = await discoverAsset({ topic: "The human heart pumps blood" });
  console.log("discover heart:", d1.decision, d1.asset?.name);

  // discovery — off-catalog topic, no stock (fallback path)
  const d2 = await discoverAsset({ topic: "quasars and pulsars", allowGenerate: true });
  console.log("discover quasars:", d2.decision, d2.asset?.name, "|", d2.notes.slice(-1)[0]);

  // sanitiser
  const evil = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect onclick="x()" width="10" height="10"/><a href="javascript:alert(1)"><circle r="5"/><foreignObject><body>hi</body></foreignObject></a></svg>';
  const clean = sanitizeSvg(evil);
  console.log("sanitiser:", clean !== null, "script removed:", !clean?.includes("script"), "onclick removed:", !clean?.includes("onclick"));
  if (clean === null || clean?.includes("<script") || clean?.includes("onclick")) throw new Error("sanitiser failed");
  const broken = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><g><g></g></svg>');
  if (broken !== null) throw new Error("sanitiser accepted malformed svg");

  const stats = await libraryStats();
  console.log("stats:", JSON.stringify(stats));
  console.log("SMOKE TEST PASSED");
  process.exit(0);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
