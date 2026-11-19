// Maintenance: replace stored catalog SVGs with current generator output.
// Deletes catalog-sourced rows (and their files), then re-seeds fresh.
// Usage: bun scripts/reseed-catalog.ts
import { db } from "../src/lib/db";
import { deleteAssetFile } from "../src/assets/server/storage";
import { ensureCatalogSeeded } from "../src/assets/server/library";

async function main() {
  const old = await db.visualAsset.findMany({ where: { source: "catalog" } });
  for (const a of old) {
    deleteAssetFile(a.filePath);
    await db.visualAsset.delete({ where: { id: a.id } });
  }
  console.log(`removed ${old.length} catalog rows`);
  const res = await ensureCatalogSeeded(true);
  console.log("reseeded:", JSON.stringify(res));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
