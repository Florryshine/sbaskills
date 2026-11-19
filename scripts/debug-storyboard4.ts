// Dump raw storyboard LLM output for offline analysis.
import { getZai } from "../src/cartoon/server/zai";
import { buildPrompt } from "../src/cartoon/server/storyboard";
import type { KALike } from "../src/cartoon/server/storyboard";
import fs from "fs";

const ka = (JSON.parse(fs.readFileSync("/tmp/ka-test.json", "utf-8")) as KALike[])[0];

async function main() {
  const zai = await getZai();
  const res = await zai.chat.completions.create({
    messages: [
      { role: "system", content: "You are a storyboard JSON generator. You reply with ONLY valid raw JSON matching the requested schema. No explanations, no markdown." },
      { role: "user", content: buildPrompt(ka) },
    ],
    thinking: { type: "disabled" },
  });
  const text = res.choices?.[0]?.message?.content ?? "";
  fs.writeFileSync("/tmp/raw-storyboard.txt", text);
  console.log("saved", text.length, "chars");
  process.exit(0);
}
main();
