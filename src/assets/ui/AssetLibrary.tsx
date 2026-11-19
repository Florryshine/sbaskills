"use client";
// Shared Visual Asset Library — admin UI (section 7).
// One library for every SBA production engine: browse/search, generate SVGs
// (built-in catalog + AI), import free stock images with licence metadata,
// run intelligent discovery, edit metadata, watch storage usage.
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Sparkles, ImageIcon, Wand2, RefreshCw, Trash2, Loader2,
  Palette, Globe, Compass, Info, Pencil, Copy, CheckCircle2, AlertTriangle,
  Boxes, HardDrive, X,
} from "lucide-react";

// ---------------------------------------------------------------- types --
interface VisualAsset {
  id: string; name: string; slug: string; description: string;
  subject: string; category: string; assetType: string; keywords: string[];
  publicUrl: string; filePath: string; mimeType: string;
  width: number | null; height: number | null; fileSizeBytes: number;
  source: string; sourceRef: string | null; sourceUrl: string | null;
  creator: string | null; license: string; licenseUrl: string | null;
  attributionRequired: boolean; attribution: string | null;
  generationParams: Record<string, unknown>;
  usageCount: number; isActive: boolean; createdAt: string;
}
interface Stats { total: number; byType: Record<string, number>; bySource: Record<string, number>; totalBytes: number }
interface ProviderStatus { provider: string; configured: boolean }
interface StockCandidate {
  provider: string; id: string; title: string; thumbUrl: string; fullUrl: string;
  pageUrl: string; width: number | null; height: number | null; creator: string | null;
  license: string; licenseUrl: string | null; attributionRequired: boolean; attribution: string;
}
interface StockSearchResponse { results: StockCandidate[]; providers: Array<{ provider: string; status: string; message?: string }> }
interface DiscoverResponse {
  decision: string; method?: string; asset?: VisualAsset;
  alternatives: VisualAsset[]; candidates?: StockCandidate[];
  notes: string[]; providers?: Array<{ provider: string; status: string; message?: string }>;
}

const CATEGORIES = ["organ", "cell", "microorganism", "plant", "animal", "molecule", "science-object", "diagram", "object", "character", "background"];
const SUBJECTS = ["General", "Biology", "Chemistry", "Physics", "Earth & Space", "Mathematics", "Geography", "English"];

const SOURCE_TONE: Record<string, string> = {
  catalog: "bg-emerald-100 text-emerald-800",
  "svg-llm": "bg-purple-100 text-purple-800",
  upload: "bg-slate-100 text-slate-700",
  openverse: "bg-sky-100 text-sky-800",
  wikimedia: "bg-sky-100 text-sky-800",
  pexels: "bg-teal-100 text-teal-800",
  pixabay: "bg-green-100 text-green-800",
  unsplash: "bg-zinc-100 text-zinc-800",
};

const fmtBytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// ================================================================ page ==
export default function AssetLibrary() {
  const { toast } = useToast();
  const [assets, setAssets] = React.useState<VisualAsset[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [providers, setProviders] = React.useState<ProviderStatus[]>([]);
  const [q, setQ] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [assetType, setAssetType] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const [detail, setDetail] = React.useState<VisualAsset | null>(null);
  const [genOpen, setGenOpen] = React.useState(false);
  const [stockOpen, setStockOpen] = React.useState(false);
  const [discOpen, setDiscOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (q.trim()) params.set("q", q.trim());
      if (subject) params.set("subject", subject);
      if (category) params.set("category", category);
      if (assetType) params.set("assetType", assetType);
      const r = await fetch(`/api/assets?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAssets(d.assets || []);
      setStats(d.stats || null);
      setProviders(d.providers || []);
    } catch (e) {
      toast({ title: "Could not load library", description: e instanceof Error ? e.message : "error" });
    } finally { setLoading(false); }
  }, [q, subject, category, assetType, toast]);

  React.useEffect(() => {
    const t = setTimeout(() => { void load(); }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const onGenerated = (a: VisualAsset, dup: boolean) => {
    toast({ title: dup ? "Already in the library" : "Asset created", description: dup ? "Identical content existed — dedup kept storage clean." : a.name });
    setDetail(a);
    void load();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fbff]">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a73e8] text-lg font-black text-white">S</div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold leading-tight text-slate-900">Shared Visual Asset Library</h1>
            <p className="text-[11px] text-slate-500">Shiney Brain Academy · one library for Cartoon, Whiteboard, Notebook &amp; every engine</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="/" className="rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">← Cartoon Studio</a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-4">
        {/* stats + actions */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StatChip icon={<Boxes className="h-4 w-4 text-[#1a73e8]" />} label="Assets" value={String(stats?.total ?? "…")} />
          <StatChip icon={<Palette className="h-4 w-4 text-purple-500" />} label="SVG" value={String(stats?.byType?.svg ?? 0)} />
          <StatChip icon={<ImageIcon className="h-4 w-4 text-teal-600" />} label="Images" value={String((stats?.byType?.image ?? 0) + (stats?.byType?.["3d"] ?? 0))} />
          <StatChip icon={<HardDrive className="h-4 w-4 text-slate-500" />} label="Storage" value={stats ? fmtBytes(stats.totalBytes) : "…"} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setDiscOpen(true)}><Compass className="mr-1.5 h-3.5 w-3.5" /> Smart discovery</Button>
            <Button size="sm" variant="outline" onClick={() => setStockOpen(true)}><Globe className="mr-1.5 h-3.5 w-3.5" /> Stock images</Button>
            <Button size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={() => setGenOpen(true)}><Wand2 className="mr-1.5 h-3.5 w-3.5" /> Generate SVG</Button>
          </div>
        </div>

        {/* filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, keyword, subject…" className="pl-8" />
          </div>
          <Select value={subject || undefined} onValueChange={(v) => setSubject(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="All subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All subjects</SelectItem>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category || undefined} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={assetType || undefined} onValueChange={(v) => setAssetType(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All types</SelectItem>
              <SelectItem value="svg" className="text-xs">SVG</SelectItem>
              <SelectItem value="image" className="text-xs">Image</SelectItem>
              <SelectItem value="3d" className="text-xs">3D</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#1a73e8]" /></div>
        ) : assets.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">
            No assets match. Try clearing filters — or generate something new.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {assets.map((a) => (
              <button key={a.id} onClick={() => setDetail(a)}
                className="group overflow-hidden rounded-xl border bg-white text-left transition-all hover:border-[#1a73e8] hover:shadow-md">
                <div className="checker flex h-[120px] items-center justify-center overflow-hidden p-2">
                  <img src={a.publicUrl} alt={a.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="border-t p-2">
                  <div className="truncate text-xs font-bold">{a.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="text-[9px]">{a.subject}</Badge>
                    <Badge variant="secondary" className="text-[9px]">{a.category}</Badge>
                    <Badge className={`text-[9px] ${SOURCE_TONE[a.source] || "bg-slate-100 text-slate-700"}`}>{a.source}</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400">
                    <span>{fmtBytes(a.fileSizeBytes)}</span>
                    <span>used ×{a.usageCount}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t bg-white py-3 text-center text-[11px] text-slate-400">
        Shared Visual Asset Library · local SVG generation first · free stock sources · hard dedup by content hash · zero paid dependencies
      </footer>

      {/* dialogs */}
      <DetailDialog asset={detail} onClose={() => setDetail(null)} onChanged={(a) => { setDetail(a); void load(); }} onDeleted={() => { setDetail(null); void load(); }} />
      <GenerateDialog open={genOpen} onOpenChange={setGenOpen} onGenerated={onGenerated} />
      <StockDialog open={stockOpen} onOpenChange={setStockOpen} providers={providers} onImported={onGenerated} />
      <DiscoverDialog open={discOpen} onOpenChange={setDiscOpen} onImported={onGenerated} />
    </div>
  );
}

function StatChip(p: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
      {p.icon}
      <div>
        <div className="text-sm font-extrabold leading-none">{p.value}</div>
        <div className="text-[10px] text-slate-400">{p.label}</div>
      </div>
    </div>
  );
}

// ============================================================ detail ====
function DetailDialog(p: { asset: VisualAsset | null; onClose: () => void; onChanged: (a: VisualAsset) => void; onDeleted: () => void }) {
  const { toast } = useToast();
  const [edit, setEdit] = React.useState(false);
  const [draft, setDraft] = React.useState<Partial<VisualAsset>>({});
  const [kwText, setKwText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setEdit(false); setDraft({});
    setKwText(p.asset?.keywords?.join(", ") || "");
  }, [p.asset]);

  if (!p.asset) return null;
  const a = p.asset;
  const isCatalog = a.source === "catalog";

  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/assets/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name ?? a.name,
          description: draft.description ?? a.description,
          subject: draft.subject ?? a.subject,
          category: draft.category ?? a.category,
          keywords: kwText.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "Metadata saved" });
      p.onChanged(d.asset);
      setEdit(false);
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "error" });
    } finally { setBusy(false); }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/assets/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "SVG regenerated from the generator" });
      p.onChanged(d.asset);
    } catch (e) {
      toast({ title: "Regenerate failed", description: e instanceof Error ? e.message : "error" });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`Delete "${a.name}" from the library? Scenes using it will simply draw without it.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/assets/${a.id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      toast({ title: "Asset deleted" });
      p.onDeleted();
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "error" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!p.asset} onOpenChange={(o) => { if (!o) p.onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="pr-6">{a.name}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div>
            <div className="checker flex h-[200px] items-center justify-center rounded-xl border p-3">
              <img src={a.publicUrl} alt={a.name} className="max-h-full max-w-full object-contain" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Badge className={`text-[10px] ${SOURCE_TONE[a.source] || "bg-slate-100"}`}>{a.source}</Badge>
              <Badge variant="secondary" className="text-[10px]">{a.assetType}</Badge>
              {a.width ? <Badge variant="secondary" className="text-[10px]">{a.width}×{a.height}</Badge> : null}
              <Badge variant="secondary" className="text-[10px]">{fmtBytes(a.fileSizeBytes)}</Badge>
              <Badge variant="secondary" className="text-[10px]">used ×{a.usageCount}</Badge>
            </div>
            <div className="mt-2 flex gap-1.5">
              {isCatalog && !edit && (
                <Button size="sm" variant="outline" onClick={regenerate} disabled={busy}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Regenerate
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setEdit(!edit)}><Pencil className="mr-1 h-3 w-3" /> {edit ? "Cancel" : "Edit"}</Button>
            </div>
          </div>
          <div className="min-w-0 space-y-2.5">
            {edit ? (
              <>
                <div><Label className="text-xs">Name</Label><Input className="mt-1 h-8 text-sm" value={draft.name ?? a.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div><Label className="text-xs">Description</Label><Textarea className="mt-1 text-xs" rows={2} value={draft.description ?? a.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Subject</Label>
                    <Select value={(draft.subject ?? a.subject)} onValueChange={(v) => setDraft({ ...draft, subject: v })}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label className="text-xs">Category</Label>
                    <Select value={(draft.category ?? a.category)} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div><Label className="text-xs">Keywords (comma separated)</Label><Input className="mt-1 h-8 text-sm" value={kwText} onChange={(e) => setKwText(e.target.value)} /></div>
                <Button size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={save} disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />} Save
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">{a.description || <i className="text-slate-400">No description yet.</i>}</p>
                <div className="text-xs text-slate-500"><b className="text-slate-700">Subject:</b> {a.subject} · <b className="text-slate-700">Category:</b> {a.category}</div>
                <div className="flex flex-wrap gap-1">{a.keywords.slice(0, 12).map((k) => <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>)}</div>
                <div className="rounded-lg bg-slate-50 p-2.5 text-xs">
                  <div className="font-bold text-slate-700">Licence</div>
                  <div className="mt-0.5 text-slate-600">{a.license}{a.licenseUrl && <> · <a href={a.licenseUrl} target="_blank" rel="noreferrer" className="text-[#1a73e8] hover:underline">terms</a></>}</div>
                  {a.creator && <div className="mt-0.5 text-slate-600">Creator: {a.creator}</div>}
                  {a.attribution && (
                    <div className="mt-1.5 flex items-start gap-1.5">
                      <code className="min-w-0 flex-1 whitespace-pre-wrap break-words rounded bg-white p-1.5 text-[10px] text-slate-600">{a.attribution}</code>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => { void navigator.clipboard.writeText(a.attribution || ""); toast({ title: "Attribution copied" }); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {a.attributionRequired && <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700"><AlertTriangle className="h-3 w-3" /> Attribution required when publishing</div>}
                  {a.sourceUrl && <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-[#1a73e8] hover:underline">Source page</a>}
                </div>
                <div className="text-[10px] text-slate-400">File: {a.filePath} · added {new Date(a.createdAt).toLocaleDateString()}</div>
                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={remove} disabled={busy}>
                  <Trash2 className="mr-1 h-3 w-3" /> Delete asset
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================== generate ===
function GenerateDialog(p: { open: boolean; onOpenChange: (o: boolean) => void; onGenerated: (a: VisualAsset, dup: boolean) => void }) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"catalog" | "ai">("catalog");
  const [catalog, setCatalog] = React.useState<Array<{ key: string; name: string; subject: string; category: string; description: string }>>([]);
  const [catQ, setCatQ] = React.useState("");
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [aiSubject, setAiSubject] = React.useState("General");
  const [aiCategory, setAiCategory] = React.useState("object");
  const [aiBusy, setAiBusy] = React.useState(false);

  React.useEffect(() => {
    if (p.open) {
      fetch("/api/assets/generate").then((r) => r.json()).then((d) => setCatalog(d.catalog || [])).catch(() => {});
    }
  }, [p.open]);

  const genCatalog = async (key: string) => {
    setBusyKey(key);
    try {
      const r = await fetch("/api/assets/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "catalog", key }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      p.onGenerated(d.asset, d.duplicate);
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "error" });
    } finally { setBusyKey(null); }
  };

  const genAi = async () => {
    if (!prompt.trim()) return;
    setAiBusy(true);
    try {
      const r = await fetch("/api/assets/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "llm", prompt: prompt.trim(), subject: aiSubject, category: aiCategory }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      p.onGenerated(d.asset, d.duplicate);
      setPrompt("");
    } catch (e) {
      toast({ title: "AI illustration failed", description: e instanceof Error ? e.message : "error" });
    } finally { setAiBusy(false); }
  };

  const filtered = catalog.filter((c) => !catQ.trim() || `${c.name} ${c.subject} ${c.category}`.toLowerCase().includes(catQ.toLowerCase()));

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Generate a visual asset</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "catalog" ? "default" : "outline"} className={tab === "catalog" ? "bg-[#1a73e8]" : ""} onClick={() => setTab("catalog")}>
            <Boxes className="mr-1 h-3.5 w-3.5" /> Built-in catalog ({catalog.length})
          </Button>
          <Button size="sm" variant={tab === "ai" ? "default" : "outline"} className={tab === "ai" ? "bg-[#1a73e8]" : ""} onClick={() => setTab("ai")}>
            <Sparkles className="mr-1 h-3.5 w-3.5" /> AI illustration
          </Button>
        </div>
        {tab === "catalog" ? (
          <>
            <p className="text-xs text-slate-500">Deterministic local generators — instant, free, offline. Anything generated is deduped by content hash.</p>
            <Input value={catQ} onChange={(e) => setCatQ(e.target.value)} placeholder="Filter catalog…" className="h-8 text-sm" />
            <ScrollArea className="h-[340px] pr-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filtered.map((c) => (
                  <button key={c.key} onClick={() => genCatalog(c.key)} disabled={busyKey !== null}
                    className="rounded-lg border p-2 text-left transition-all hover:border-[#1a73e8] hover:bg-blue-50/50 disabled:opacity-50">
                    <div className="text-xs font-bold leading-tight">{c.name}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{c.subject} · {c.category}</div>
                    {busyKey === c.key && <Loader2 className="mt-1 h-3 w-3 animate-spin text-[#1a73e8]" />}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500">Describe an illustration not in the catalog. The AI returns a sanitised, self-contained SVG — stored with the same dedup and licence tracking.</p>
            <div><Label className="text-xs">Illustration prompt</Label>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                placeholder="e.g. A friendly cartoon volcano erupting with labelled magma chamber" className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Subject</Label>
                <Select value={aiSubject} onValueChange={setAiSubject}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs">Category</Label>
                <Select value={aiCategory} onValueChange={setAiCategory}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <Button className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={genAi} disabled={aiBusy || !prompt.trim()}>
              {aiBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />}
              {aiBusy ? "Illustrating…" : "Generate illustration"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================== stock ===
function StockDialog(p: { open: boolean; onOpenChange: (o: boolean) => void; providers: ProviderStatus[]; onImported: (a: VisualAsset, dup: boolean) => void }) {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [res, setRes] = React.useState<StockSearchResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [importing, setImporting] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/assets/stock", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query: query.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRes(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "search failed");
    } finally { setBusy(false); }
  };

  const importOne = async (c: StockCandidate) => {
    setImporting(c.provider + c.id);
    try {
      const r = await fetch("/api/assets/stock", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", candidate: c }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const ar = await fetch(`/api/assets/${d.assetId}`);
      const ad = await ar.json();
      p.onImported(ad.asset, d.duplicate);
    } catch (e) {
      toast({ title: "Import failed", description: e instanceof Error ? e.message : "error" });
    } finally { setImporting(null); }
  };

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Free stock images</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-500">
          Openverse &amp; Wikimedia need no key. Pexels, Pixabay and Unsplash have free tiers — add
          <code className="mx-1 rounded bg-slate-100 px-1">PEXELS_API_KEY</code>/
          <code className="mx-1 rounded bg-slate-100 px-1">PIXABAY_API_KEY</code>/
          <code className="mx-1 rounded bg-slate-100 px-1">UNSPLASH_ACCESS_KEY</code> to .env to enable them.
          Every import stores its licence and attribution.
        </p>
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
            placeholder="Search e.g. volcano eruption, classroom children…" className="h-9" />
          <Button className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={search} disabled={busy || !query.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {err && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div><b>Stock providers unavailable:</b> {err}. The library and local SVG generation keep working — external services are optional.</div>
          </div>
        )}
        {res && (
          <div className="flex flex-wrap gap-1.5">
            {res.providers.map((pr) => (
              <Badge key={pr.provider} variant="secondary" className={`text-[10px] ${pr.status === "ok" ? "bg-emerald-100 text-emerald-800" : pr.status === "no-key" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-800"}`}>
                {pr.provider}: {pr.status}
              </Badge>
            ))}
          </div>
        )}
        <ScrollArea className="h-[320px] pr-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(res?.results || []).map((c) => (
              <div key={c.provider + c.id} className="overflow-hidden rounded-lg border">
                <div className="h-[110px] bg-slate-100">
                  {c.thumbUrl ? <img src={c.thumbUrl} alt={c.title} loading="lazy" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="p-2">
                  <div className="truncate text-[11px] font-bold">{c.title}</div>
                  <div className="truncate text-[9px] text-slate-400">{c.creator} · {c.license}</div>
                  {c.attributionRequired && <div className="mt-0.5 text-[9px] font-semibold text-amber-700">credit required</div>}
                  <Button size="sm" variant="outline" className="mt-1.5 h-6 w-full text-[10px]" onClick={() => importOne(c)} disabled={importing !== null}>
                    {importing === c.provider + c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3" /> Import</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {res && res.results.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">No images found. Check provider status chips above.</div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================== discover ===
function DiscoverDialog(p: { open: boolean; onOpenChange: (o: boolean) => void; onImported: (a: VisualAsset, dup: boolean) => void }) {
  const { toast } = useToast();
  const [topic, setTopic] = React.useState("");
  const [subject, setSubject] = React.useState("General");
  const [category, setCategory] = React.useState("");
  const [allowLlm, setAllowLlm] = React.useState(false);
  const [allowStock, setAllowStock] = React.useState(false);
  const [autoImport, setAutoImport] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<DiscoverResponse | null>(null);

  const run = async () => {
    if (!topic.trim()) return;
    setBusy(true); setResult(null);
    try {
      const r = await fetch("/api/assets/discover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(), subject, category: category || undefined,
          allowLlm, allowStock, autoImportStock: autoImport,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (e) {
      toast({ title: "Discovery failed", description: e instanceof Error ? e.message : "error" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Smart asset discovery</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-500">
          The production engine runs this automatically before every scene: reuse the library → generate local SVG →
          fetch free stock. This panel lets you run or inspect the same decision.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label className="text-xs">Topic / scene description</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. How plants make food from sunlight" className="mt-1 h-8 text-sm" /></div>
          <div><Label className="text-xs">Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-xs">Preferred category (optional)</Label>
            <Select value={category || "any"} onValueChange={(v) => setCategory(v === "any" ? "" : v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any" className="text-xs">Any category</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select></div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-1.5"><Switch checked={allowLlm} onCheckedChange={setAllowLlm} /> Allow AI illustration</label>
          <label className="flex items-center gap-1.5"><Switch checked={allowStock} onCheckedChange={setAllowStock} /> Allow stock search</label>
          <label className="flex items-center gap-1.5"><Switch checked={autoImport} onCheckedChange={setAutoImport} disabled={!allowStock} /> Auto-import best stock hit</label>
        </div>
        <Button className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={run} disabled={busy || !topic.trim()}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Compass className="mr-1.5 h-4 w-4" />}
          {busy ? "Deciding…" : "Run discovery"}
        </Button>
        {result && (
          <div className="space-y-2 rounded-xl border bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Badge className={result.decision === "library" ? "bg-emerald-100 text-emerald-800" : result.decision === "generated-svg" ? "bg-purple-100 text-purple-800" : "bg-sky-100 text-sky-800"}>
                {result.decision}
              </Badge>
              {result.asset && <span className="text-sm font-bold">{result.asset.name}</span>}
            </div>
            {result.asset && (
              <div className="checker flex h-[150px] items-center justify-center rounded-lg border bg-white p-2">
                <img src={result.asset.publicUrl} alt={result.asset.name} className="max-h-full max-w-full object-contain" />
              </div>
            )}
            {result.candidates && result.candidates.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-600">Stock candidates (review licence, then import in Stock panel):</div>
                <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1">
                  {result.candidates.slice(0, 6).map((c) => (
                    <div key={c.provider + c.id} className="w-[90px] shrink-0">
                      {c.thumbUrl ? <img src={c.thumbUrl} alt={c.title} className="h-[60px] w-[90px] rounded object-cover" /> : null}
                      <div className="truncate text-[9px] text-slate-500">{c.provider}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-0.5 text-[11px] text-slate-500">
              {result.notes.map((n, i) => <div key={i} className="flex gap-1"><Info className="mt-0.5 h-3 w-3 shrink-0" /> {n}</div>)}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
