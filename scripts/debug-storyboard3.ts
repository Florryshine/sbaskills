// Full storyboard generation test with the repaired parser.
import { generateStoryboard } from "../src/cartoon/server/storyboard";
import type { KALike } from "../src/cartoon/server/storyboard";
import fs from "fs";

const kas = JSON.parse(fs.readFileSync("/tmp/ka-test.json", "utf-8")) as KALike[];

async function main() {
  for (const ka of kas) {
    const t0 = Date.now();
    const { spec, usedFallback, error } = await generateStoryboard(ka);
    console.log(`\n=== ${ka.keyword} === (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    console.log("usedFallback:", usedFallback, error || "");
    console.log("title:", spec.title, "| music:", spec.music, "| chars:", spec.characters.map((c) => `${c.ref}:${c.name}`).join(", "));
    for (const s of spec.scenes) {
      console.log(`  ${s.id}: [${s.visualConcept}] "${s.heading}" cast=[${s.cast.map((c) => `${c.ref}:${c.action}/${c.expression}${c.speaking ? "+talk" : ""}`).join(" ")}] props=[${s.props.map((p) => p.kind).join(",")}] ${s.camera}/${s.transition}`);
    }
  }
  process.exit(0);
}
main();
