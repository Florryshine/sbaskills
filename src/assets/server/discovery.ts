// Intelligent asset discovery — the decision engine of the Shared Visual
// Asset Library (requirement D):
//   1. search the existing library first (reuse before anything else)
//   2. nothing suitable? generate a local SVG (catalog, then LLM)
//   3. still nothing? retrieve an appropriately licensed stock image
//      (auto-import opt-in; otherwise return candidates for review)
//   4. external services down / no match? fall back to the library's
//      generic assets — the engine NEVER blocks on third parties.
import { searchAssets, ensureCatalogSeeded, bumpUsage, type VisualAssetDTO } from "./library";
import { searchStock, importStockCandidate, type StockCandidate } from "./stock";
import { generateAndStoreSvg } from "./svgLlm";

export interface DiscoverRequest {
  topic: string;
  subject?: string;
  keywords?: string[];
  category?: string;
  allowGenerate?: boolean;    // local SVG generation (default true)
  allowLlm?: boolean;         // LLM-assisted SVG (default false — UI opts in)
  allowStock?: boolean;       // stock retrieval (default false)
  autoImportStock?: boolean;  // import best stock hit automatically (default false)
}

export interface DiscoverResult {
  decision: "library" | "generated-svg" | "imported-stock" | "stock-candidates" | "fallback" | "none";
  method?: "library" | "catalog" | "svg-llm" | "stock";
  asset?: VisualAssetDTO;
  alternatives: VisualAssetDTO[];
  candidates?: StockCandidate[];
  notes: string[];
  providers?: Array<{ provider: string; status: string; message?: string }>;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
}

const STOP = new Set([
  "the", "and", "for", "with", "this", "that", "from", "into", "your", "what",
  "when", "how", "why", "are", "was", "were", "have", "has", "will", "about",
  "learn", "today", "lets", "let", "very", "some", "then", "them", "they",
]);

export async function discoverAsset(req: DiscoverRequest): Promise<DiscoverResult> {
  const notes: string[] = [];
  const allowGenerate = req.allowGenerate !== false;

  // 0) make sure the built-in library exists (idempotent, local, free)
  await ensureCatalogSeeded();

  // 1) library first — always
  const baseTerms = [req.topic, ...(req.keywords || [])].join(" ");
  const subject = req.subject?.trim();

  const trySearch = async (q: string, category?: string) =>
    searchAssets({ q, subject: undefined, category, limit: 12 });

  let found: VisualAssetDTO[] = [];
  if (req.category) found = await trySearch(baseTerms, req.category);
  if (!found.length) found = await trySearch(baseTerms);
  if (!found.length && subject) found = await searchAssets({ q: baseTerms, subject, limit: 12 });
  if (!found.length) {
    // token-optimised retry
    const tokens = Array.from(new Set([...tokenize(baseTerms), ...tokenize(subject || "")]));
    if (tokens.length) {
      const q2 = tokens.slice(0, 6).join(" ");
      if (req.category) found = await trySearch(q2, req.category);
      if (!found.length) found = await trySearch(q2);
    }
  }

  const quality = (a: VisualAssetDTO) =>
    (req.category && a.category === req.category ? 2 : 0) +
    (subject && a.subject === subject ? 2 : a.subject === "General" ? 0.5 : 1);

  if (found.length) {
    found.sort((a, b) => quality(b) - quality(a) || b.usageCount - a.usageCount);
    const best = found[0];
    notes.push(`Found "${best.name}" in the existing library (source: ${best.source}) — reused, nothing new stored.`);
    return {
      decision: "library", method: "library", asset: best,
      alternatives: found.slice(1, 8), notes,
    };
  }
  notes.push("No suitable asset in the library yet.");

  // 2) local SVG generation (free, offline, instant)
  if (allowGenerate) {
    if (req.allowLlm) {
      try {
        notes.push("Generating an original SVG illustration locally (AI-assisted)…");
        const g = await generateAndStoreSvg({
          prompt: req.topic,
          name: req.topic,
          subject: subject || "General",
          category: req.category || "object",
        });
        notes.push(g.duplicate ? "Generated SVG matched an existing asset — reused it." : "Generated and stored a new original SVG asset.");
        const full = await (await import("./library")).getAsset(g.assetId);
        if (full) {
          return { decision: "generated-svg", method: "svg-llm", asset: full, alternatives: [], notes };
        }
      } catch (e) {
        notes.push(`AI SVG generation unavailable: ${e instanceof Error ? e.message.slice(0, 140) : "error"}.`);
      }
    } else {
      notes.push("Local generation limited to the built-in catalog (enable AI for open-ended topics).");
    }
  }

  // 3) stock retrieval (free providers, licence metadata always captured)
  if (req.allowStock) {
    try {
      notes.push("Searching free stock providers (Openverse, Wikimedia, Pexels, Pixabay, Unsplash)…");
      const sr = await searchStock(req.topic + " " + (req.keywords || []).join(" "));
      if (sr.providers) notes.push(...sr.providers.map((p) => `${p.provider}: ${p.status}${p.message ? ` (${p.message})` : ""}`));
      if (sr.results.length) {
        if (req.autoImportStock) {
          // prefer licences that allow reuse without extra conditions:
          // CC0/public domain first, then everything else (all tracked).
          const sorted = [...sr.results].sort((a, b) =>
            Number(a.attributionRequired) - Number(b.attributionRequired));
          const pick = sorted[0];
          try {
            const imp = await importStockCandidate(pick);
            const full = (await (await import("./library")).getAsset(imp.assetId));
            notes.push(imp.duplicate
              ? `Stock image already in the library — reused it (${pick.provider}).`
              : `Imported "${pick.title}" from ${pick.provider} (${pick.license}).`);
            if (full) {
              return { decision: "imported-stock", method: "stock", asset: full, alternatives: [], candidates: sorted.slice(1, 9), notes, providers: sr.providers };
            }
          } catch (e) {
            notes.push(`Stock import failed: ${e instanceof Error ? e.message.slice(0, 140) : "error"}.`);
          }
        }
        return { decision: "stock-candidates", candidates: sr.results.slice(0, 12), alternatives: [], notes, providers: sr.providers };
      }
    } catch (e) {
      notes.push(`Stock search unavailable: ${e instanceof Error ? e.message.slice(0, 140) : "error"}.`);
    }
  }

  // 4) graceful fallback: nearest generic library asset, clearly labelled
  const generic = await searchAssets({ q: "", category: req.category, limit: 12 });
  let fallbackPool = generic;
  if (!fallbackPool.length) {
    const subjectPool = await searchAssets({ q: "", subject: subject || "General", limit: 12 });
    // prefer full-scene backgrounds in subject fallbacks (they suit any topic)
    fallbackPool = subjectPool.sort(
      (a, b) => Number(b.category === "background") - Number(a.category === "background"),
    );
  }
  if (!fallbackPool.length && subject !== "General") {
    fallbackPool = await searchAssets({ q: "", subject: "General", limit: 1 });
  }
  // prefer a *sensible representative* per category instead of an arbitrary row
  const PREFERRED_FALLBACK: Record<string, string> = {
    organ: "Human Heart", cell: "Animal Cell", microorganism: "Bacterium",
    plant: "Leaf", animal: "Fish", molecule: "Water Molecule",
    "science-object": "Erlenmeyer Flask", diagram: "Photosynthesis",
    object: "Stack of Books", background: "Sunny Sky Scene", character: "Stack of Books",
  };
  const preferred = PREFERRED_FALLBACK[req.category || ""];
  fallbackPool = [...fallbackPool].sort((a, b) =>
    Number(b.name === preferred) - Number(a.name === preferred));
  if (fallbackPool.length) {
    notes.push(`Falling back to a generic library asset ("${fallbackPool[0].name}") — the engine stays functional.`);
    return { decision: "fallback", method: "library", asset: fallbackPool[0], alternatives: [], notes };
  }
  return { decision: "none", alternatives: [], notes: [...notes, "Library empty — seed the catalog first."] };
}

// ---------------------------------------------------------- scene wiring ---

/** Where a custom asset may sit for each scene layout (0..1000 grid,
 * same coordinate space as props/cast; avoids the character band). */
const LAYOUT_SLOTS: Record<string, Array<{ x: number; y: number }>> = {
  "focus-left": [{ x: 800, y: 250 }, { x: 830, y: 620 }],
  "focus-right": [{ x: 200, y: 250 }, { x: 170, y: 620 }],
  "focus-center": [{ x: 160, y: 280 }, { x: 840, y: 660 }],
  split: [{ x: 210, y: 230 }, { x: 790, y: 660 }],
  journey: [{ x: 500, y: 190 }, { x: 780, y: 320 }],
  diagram: [{ x: 500, y: 640 }, { x: 170, y: 260 }],
};

const CONCEPT_CATEGORY: Record<string, string> = {
  classroom: "object", park: "plant", city: "object", bloodstream: "cell",
  "leaf-world": "plant", "chemistry-lab": "science-object", space: "science-object",
  "water-cycle": "diagram", ocean: "animal", farm: "animal", stage: "object",
  abstract: "object",
};

export interface SceneForDiscovery {
  id: string;
  heading: string;
  narration: string;
  visualConcept: string;
  layout: string;
}

export interface SceneAssetAttachment {
  sceneId: string;
  assets: Array<{ assetId: string; url: string; x: number; y: number; scale: number; popAt: number; name: string; license: string }>;
  notes: string[];
}

/** Auto-attach up to `maxPerScene` library assets to each scene.
 * Library-only + catalog generation (no network, no LLM) so the cartoon
 * pipeline can call it safely in the background. */
export async function discoverForScenes(
  scenes: SceneForDiscovery[],
  opts: { subject?: string; maxPerScene?: number; extraKeywords?: Record<string, string[]> } = { },
): Promise<SceneAssetAttachment[]> {
  await ensureCatalogSeeded();
  const max = Math.max(0, Math.min(3, opts.maxPerScene ?? 2));
  const out: SceneAssetAttachment[] = [];

  for (const scene of scenes) {
    const attach: SceneAssetAttachment["assets"] = [];
    const notes: string[] = [];
    if (max > 0) {
      const category = CONCEPT_CATEGORY[scene.visualConcept];
      const keywords = [
        ...(opts.extraKeywords?.[scene.id] || []),
        ...tokenize(scene.heading),
        ...tokenize(scene.narration).slice(0, 8),
      ];
      const topic = scene.heading || tokenize(scene.narration).slice(0, 5).join(" ");
      // discovery without stock/LLM: reuse library, else generate from catalog
      const res = await discoverAsset({
        topic,
        subject: opts.subject,
        keywords,
        category,
        allowGenerate: true,
        allowLlm: false,
        allowStock: false,
      });
      notes.push(...res.notes);
      if (res.asset) {
        const slots = LAYOUT_SLOTS[scene.layout] || LAYOUT_SLOTS["focus-center"];
        const slot = slots[0];
        attach.push({
          assetId: res.asset.id, url: res.asset.publicUrl,
          x: slot.x, y: slot.y, scale: 1.0, popAt: 0.35,
          name: res.asset.name, license: res.asset.license,
        });
        void bumpUsage(res.asset.id);
      }
    }
    out.push({ sceneId: scene.id, assets: attach, notes });
  }
  return out;
}
