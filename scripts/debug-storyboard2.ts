// Debug the real storyboard prompt end-to-end and print raw output tail.
import { getZai, parseJsonFromText } from "../src/cartoon/server/zai";
import { buildPrompt } from "../src/cartoon/server/storyboard";
import type { KALike } from "../src/cartoon/server/storyboard";

const ka: KALike = {
  keyword: "The Human Heart and Blood Circulation",
  subject: "Biology",
  summary: "The heart is a muscular pump that beats 70-80 times per minute, pushing blood through pulmonary and systemic circuits. It has four chambers and valves that keep blood flowing one way.",
  subTopics: JSON.stringify([
    { title: "Structure of the heart", explanation: "Four chambers: two atria receive blood, two ventricles pump it out." },
    { title: "Double circulation", explanation: "Pulmonary circuit goes to the lungs; systemic circuit goes to the body." },
  ]),
  facts: JSON.stringify(["The heart beats about 100,000 times a day."]),
};

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
  console.log("OUTPUT LENGTH:", text.length);
  console.log("HEAD:", text.slice(0, 120));
  console.log("TAIL:", text.slice(-160));
  try {
    const parsed = parseJsonFromText(text) as { scenes?: unknown[] };
    console.log("PARSE OK, scenes:", parsed.scenes?.length);
  } catch (e) {
    console.log("PARSE FAIL:", e instanceof Error ? e.message : e);
  }
  const finish = res.choices?.[0] ? JSON.stringify(Object.keys(res.choices[0])) : "?";
  const meta = (res.choices?.[0] as unknown as { finish_reason?: string })?.finish_reason;
  console.log("finish_reason:", meta ?? finish);
  process.exit(0);
}
main();
