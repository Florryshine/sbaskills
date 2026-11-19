// Debug: raw LLM storyboard call, print the true error.
import { generateJson, getZai } from "../src/cartoon/server/zai";

async function main() {
  try {
    const r = await generateJson({
      prompt: 'Reply with ONLY raw JSON: {"ok": true, "n": 3}',
      validate: (v) => { if (!(v as { ok?: boolean }).ok) throw new Error("bad shape"); return v as { ok: boolean }; },
      attempts: 1,
    });
    console.log("simple JSON OK:", r);
  } catch (e) { console.log("simple FAIL:", e instanceof Error ? e.message : e); }

  try {
    const zai = await getZai();
    const res = await zai.chat.completions.create({
      messages: [{ role: "user", content: "Reply ONLY with raw JSON (no markdown): {\"scenes\":[{\"narration\":\"hello world\"}]} and make narration array have 7 items about the heart"}],
      thinking: { type: "disabled" },
    });
    const text = res.choices?.[0]?.message?.content ?? "";
    console.log("RAW LLM OUTPUT length:", text.length);
    console.log(text.slice(0, 600));
  } catch (e) { console.log("raw FAIL:", e instanceof Error ? e.message : e); }
  process.exit(0);
}
main();
