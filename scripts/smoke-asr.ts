import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
async function main() {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync("/tmp/tts-test.wav").toString("base64");
  const res = await zai.audio.asr.create({ file_base64: b64 });
  console.log("ASR heard:", JSON.stringify(res).slice(0, 300));
}
main().catch(e => console.error("FAIL:", e?.message || e));
