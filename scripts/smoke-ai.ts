import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

async function main() {
  const zai = await ZAI.create();
  // 1. LLM JSON test
  const res = await zai.chat.completions.create({
    messages: [{ role: "user", content: 'Reply ONLY with JSON: {"scenes":[{"narration":"one short sentence about the heart"}]}'}],
    thinking: { type: "disabled" },
  });
  console.log("LLM OK:", (res.choices?.[0]?.message?.content || "").slice(0, 200));
  // 2. TTS test - english narration
  const tts = await zai.audio.tts.create({
    input: "Inside every one of us is a powerful pump, beating about one hundred thousand times a day. Let us take a journey inside the human heart!",
    voice: "tongtong",
    speed: 1.0,
    response_format: "wav",
    stream: false,
  });
  const buf = Buffer.from(new Uint8Array(await tts.arrayBuffer()));
  fs.writeFileSync("/tmp/tts-test.wav", buf);
  console.log("TTS OK bytes:", buf.length);
}
main().catch(e => { console.error("FAIL:", e?.message || e); process.exit(1); });
