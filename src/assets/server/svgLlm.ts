// LLM-assisted SVG generation with hard sanitisation.
// Used when the built-in catalog has no match for a topic. Free-first:
// uses the same z-ai SDK already running the storyboard + TTS pipeline,
// so no new API, key or subscription is introduced.
import { getZai } from "@/cartoon/server/zai";
import { createAsset } from "./library";
import { sha256, svgDimensions } from "./storage";

const MAX_SVG_BYTES = 400 * 1024;

/** Remove scripts, event handlers, external references and foreignObject.
 * Everything must be self-contained vector art. */
export function sanitizeSvg(svg: string): string | null {
  let s = svg.trim();
  const start = s.search(/<svg[\s>]/i);
  if (start === -1) return null;
  const end = s.lastIndexOf("</svg>");
  if (end === -1 || end < start) return null;
  s = s.slice(start, end + 6);

  // normalise the svg root: ensure xmlns + viewBox
  if (!/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/.test(s)) {
    s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!/viewBox\s*=/i.test(s)) {
    s = s.replace(/<svg/i, '<svg viewBox="0 0 512 512"');
  }
  // aria + title for accessibility if missing
  if (!/role\s*=/i.test(s)) s = s.replace(/<svg/i, '<svg role="img"');

  // hard bans
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "");
  s = s.replace(/<script[^>]*\/?>/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/javascript\s*:/gi, "");
  // external references: keep only data: URIs and internal #refs
  s = s.replace(/(xlink:href|href)\s*=\s*("([^"]*)"|'([^']*)')/gi, (m, attr: string, _q: string, dq?: string, sq?: string) => {
    const v = (dq ?? sq ?? "").trim();
    if (/^(#|data:image)/.test(v)) return m;
    if (/^https?:\/\/(www\.)?(w3\.org)/i.test(v)) return m; // namespace refs
    return `${attr}="#"`;
  });
  s = s.replace(/<image[^>]*href\s*=\s*"(?!data:)[^"]*"[^>]*>/gi, "");
  s = s.replace(/@import/gi, "");

  // sanity: balanced tags, plausible size
  if (s.length > MAX_SVG_BYTES) return null;
  if (s.length < 60) return null;
  const opens = (s.match(/<[a-zA-Z][^/]*?[^/]>/g) || []).length;
  void opens;
  if (!/<\/svg\s*>\s*$/.test(s)) return null;
  // well-formedness smoke test: every <tag> has a matching </tag> (void elements excepted)
  const voidEls = new Set(["circle", "ellipse", "line", "path", "polygon", "polyline", "rect", "stop", "use", "image", "br", "hr"]);
  const stack: string[] = [];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(s))) {
    const [, close, tag, , selfClose] = m;
    const t = tag.toLowerCase();
    if (voidEls.has(t) || selfClose) continue;
    if (!close) stack.push(t);
    else {
      const top = stack.pop();
      if (top !== t) return null;
    }
  }
  if (stack.length) return null;
  return s;
}

/** Ask the LLM for an illustration and return a sanitised SVG string. */
export async function generateSvgWithLLM(opts: {
  prompt: string;
  subject?: string;
  category?: string;
  styleHint?: string;
}): Promise<{ svg: string; width: number | null; height: number | null }> {
  const zai = await getZai();
  const system = [
    "You are a children's educational illustration engine that outputs ONLY raw SVG code.",
    "Rules:",
    "- Output ONE complete <svg> element starting with <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"> and ending with </svg>. No markdown, no explanation.",
    "- Bright flat cartoon sticker style for children: bold rounded outlines (stroke #3d2f52), gradients (linearGradient/radialGradient in <defs>), painted highlights and soft shadows (no SVG filters).",
    "- Self-contained: no external images, no scripts, no event handlers, no foreignObject, no external fonts.",
    "- A small handwritten-style label at the bottom is allowed ONLY for diagrams (e.g. 'WATER CYCLE'); otherwise no text.",
    "- Use stroke-linejoin=\"round\" stroke-linecap=\"round\" everywhere; keep shapes chunky and readable at small sizes.",
    opts.styleHint ? `- Style note: ${opts.styleHint}` : "",
    opts.subject ? `- Subject area: ${opts.subject}` : "",
    opts.category === "background" ? "- Canvas 800x450 (landscape scene)." : "",
  ].filter(Boolean).join("\n");

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await zai.chat.completions.create({
        messages: [
          { role: "system", content: system },
          { role: "user", content: attempt === 0
            ? `Draw an original cartoon SVG illustration of: ${opts.prompt}`
            : `Draw an original cartoon SVG illustration of: ${opts.prompt}\n\nIMPORTANT: your previous SVG was rejected (${String(lastErr).slice(0, 120)}). Reply again with ONLY one valid, sanitised <svg> element.` },
        ],
        thinking: { type: "disabled" },
      });
      const text = res.choices?.[0]?.message?.content ?? "";
      const clean = sanitizeSvg(text);
      if (!clean) throw new Error("malformed or unsafe SVG");
      const dims = svgDimensions(clean);
      return { svg: clean, width: dims?.w ?? null, height: dims?.h ?? null };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`LLM SVG generation failed after 3 attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

/** Generate AND store as a library asset (dedup applies). */
export async function generateAndStoreSvg(opts: {
  prompt: string;
  name?: string;
  subject?: string;
  category?: string;
}): Promise<{ assetId: string; duplicate: boolean; svg: string }> {
  const { svg } = await generateSvgWithLLM(opts);
  const created = await createAsset({
    name: opts.name?.slice(0, 90) || opts.prompt.slice(0, 60) || "AI illustration",
    description: `AI-generated SVG illustration: ${opts.prompt}`,
    subject: opts.subject || "General",
    category: opts.category || "object",
    keywords: [opts.prompt, opts.subject, opts.category].filter(Boolean) as string[],
    data: Buffer.from(svg, "utf8"),
    ext: "svg",
    mimeType: "image/svg+xml",
    source: "svg-llm",
    license: "SBA Original (CC0)",
    attribution: "Shiney Brain Academy — AI-assisted original artwork",
    generationParams: { prompt: opts.prompt, generator: "svg-llm", hashAtCreate: sha256(svg).slice(0, 12) },
  });
  return { assetId: created.asset.id, duplicate: created.duplicate, svg };
}
