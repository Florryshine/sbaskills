"use client";
// Cartoon Animation Studio — the complete production workflow in one page:
// Topic (KA) -> Script -> Cast & Characters -> Scenes -> Audio -> Render -> Publish -> Library.
import React from "react";
import { Player, type PlayerRef } from "@remotion/player";
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
  BookOpenText, Film, Sparkles, Users, Music4, Clapperboard, Share2,
  Library, Plus, RefreshCw, Wand2, Play, Trash2, Download, CheckCircle2,
  AlertTriangle, Loader2, Search, Pencil, ChevronLeft, Radio,
} from "lucide-react";
import { CartoonVideo, totalDuration, sceneDuration } from "../engine/CartoonVideo";
import { VISUAL_CONCEPTS, CONCEPT_LABELS, ACTIONS, EXPRESSIONS, PROP_KINDS } from "../engine/types";
import type { Storyboard, StoryboardScene, Orientation, WordTiming } from "../engine/types";
import { CharacterStudio, type UICharacter } from "./CharacterStudio";
import { SceneAssetsPanel } from "./SceneAssetsPanel";

// ---------- types ----------
interface KA { id: string; keyword: string; subject: string; summary: string; subTopics: { title: string }[]; keyConcepts: string[]; facts: string[] }
interface Channel { id: string; platform: string; label: string; isActive: boolean; simulated: boolean }
interface ProjectRow {
  id: string; title: string; status: string; stage: string; stageMessage: string; progress: number;
  orientation: string; subtitles: boolean; createdAt: string; videoUrl: string | null;
  videoSizeBytes: number | null; durationSeconds: number | null; error: string | null;
  knowledgeAsset?: { keyword: string; subject: string } | null; customTopic: string | null;
}
interface ProjectFull extends ProjectRow {
  spec: Storyboard | null;
  narration: Record<string, { audioUrl: string; durationSeconds: number; words: WordTiming[] }>;
  knowledgeAsset?: { keyword: string; subject: string; summary: string } | null;
}
interface PublishJobRow { id: string; status: string; channel: Channel; externalUrl: string | null; lastError: string | null; attemptCount: number }
interface AssetRow { id: string; title: string; status: string; body: string; projectId: string | null; publishJobs: PublishJobRow[]; mediaFiles: { url: string; durationSeconds: number | null }[] }

const STATUS_TONE: Record<string, string> = {
  scripting: "bg-amber-100 text-amber-800", narrating: "bg-amber-100 text-amber-800",
  cast_ready: "bg-sky-100 text-sky-800", rendering: "bg-purple-100 text-purple-800",
  ready: "bg-emerald-100 text-emerald-800", failed: "bg-rose-100 text-rose-800",
  draft: "bg-slate-100 text-slate-700",
};

const STEP_LIST = [
  { key: "topic", label: "Topic", icon: BookOpenText },
  { key: "script", label: "Script", icon: Sparkles },
  { key: "cast", label: "Cast & Characters", icon: Users },
  { key: "audio", label: "Audio", icon: Music4 },
  { key: "render", label: "Render", icon: Clapperboard },
  { key: "publish", label: "Publish", icon: Share2 },
  { key: "library", label: "Library", icon: Library },
] as const;
type StepKey = (typeof STEP_LIST)[number]["key"];

const emptySpec: Storyboard = {
  title: "", description: "", caption: "", hashtags: [], music: "happy",
  characters: [], scenes: [],
};

export default function StudioPage() {
  const { toast } = useToast();
  const [step, setStep] = React.useState<StepKey>("topic");
  const [overview, setOverview] = React.useState<{ knowledgeAssets: KA[]; characters: UICharacter[]; channels: Channel[] } | null>(null);
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [project, setProject] = React.useState<ProjectFull | null>(null);
  const [spec, setSpec] = React.useState<Storyboard | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [kaQuery, setKaQuery] = React.useState("");
  const [customTopic, setCustomTopic] = React.useState("");
  const [selectedKa, setSelectedKa] = React.useState<KA | null>(null);
  const [orientation, setOrientation] = React.useState<Orientation>("9:16");
  const [subtitles, setSubtitles] = React.useState(true);
  const [sceneIdx, setSceneIdx] = React.useState(0);
  const [asset, setAsset] = React.useState<AssetRow | null>(null);
  const playerRef = React.useRef<PlayerRef>(null);

  // ---------- data loading ----------
  const loadOverview = React.useCallback(async () => {
    const r = await fetch("/api/cartoon/overview");
    if (r.ok) setOverview(await r.json());
  }, []);
  const loadProjects = React.useCallback(async () => {
    const r = await fetch("/api/cartoon/projects");
    if (r.ok) { const d = await r.json(); setProjects(d.projects); }
  }, []);
  React.useEffect(() => { void loadOverview(); void loadProjects(); }, [loadOverview, loadProjects]);

  // poll active project while pipeline works
  const projectId = project?.id;
  React.useEffect(() => {
    if (!projectId) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/cartoon/projects/${projectId}`);
      if (r.ok && !stop) {
        const d = await r.json();
        setProject(d.project);
        if (d.project.spec) setSpec(d.project.spec);
      }
    };
    void tick();
    const iv = setInterval(() => {
      if (stop) return;
      setProject((p) => {
        if (p && (p.status === "scripting" || p.status === "narrating" || p.status === "rendering")) void tick();
        return p;
      });
    }, 3000);
    return () => { stop = true; clearInterval(iv); };
  }, [projectId]);

  // ---------- actions ----------
  const createProject = async () => {
    if (!selectedKa && !customTopic.trim()) {
      toast({ title: "Pick a topic", description: "Select a Knowledge Asset or type a custom topic." });
      return;
    }
    setBusy("create");
    try {
      const r = await fetch("/api/cartoon/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeAssetId: selectedKa?.id, customTopic: customTopic.trim() || undefined, orientation, subtitles }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      await loadProjects();
      const pr = await fetch(`/api/cartoon/projects/${d.project.id}`);
      setProject((await pr.json()).project);
      setSpec(null);
      setStep("script");
      toast({ title: "Cartoon production started", description: "Writing the storyboard and generating narration..." });
    } catch (e) {
      toast({ title: "Could not start", description: e instanceof Error ? e.message : "error" });
    } finally { setBusy(null); }
  };

  const patchProject = async (body: Record<string, unknown>) => {
    if (!project) return null;
    const r = await fetch(`/api/cartoon/projects/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast({ title: "Update failed", description: d.error || d.message || "error" }); return null; }
    return d;
  };

  const regenerateScript = async () => {
    if (!project) return;
    setBusy("regen-script");
    try {
      const r = await fetch(`/api/cartoon/projects/${project.id}/regenerate-script`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "Regenerating", description: "A fresh storyboard is being written..." });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "error" });
    } finally { setBusy(null); }
  };

  const regenerateScene = async (sceneId: string, instruction?: string) => {
    if (!project) return;
    setBusy(`scene-${sceneId}`);
    try {
      const r = await fetch(`/api/cartoon/projects/${project.id}/regenerate-scene`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, instruction }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const pr = await fetch(`/api/cartoon/projects/${project.id}`);
      const pd = (await pr.json()).project as ProjectFull;
      setProject(pd); setSpec(pd.spec);
      toast({ title: "Scene regenerated", description: d.renarrated ? "New scene + narration ready." : "New scene ready." });
    } catch (e) {
      toast({ title: "Scene regeneration failed", description: e instanceof Error ? e.message : "error" });
    } finally { setBusy(null); }
  };

  const renarrate = async (sceneId?: string) => {
    if (!project) return;
    setBusy(sceneId ? `narr-${sceneId}` : "narr-all");
    try {
      const r = await fetch(`/api/cartoon/projects/${project.id}/renarrate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sceneId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const pr = await fetch(`/api/cartoon/projects/${project.id}`);
      const pd = (await pr.json()).project as ProjectFull;
      setProject(pd); setSpec(pd.spec);
      toast({ title: "Narration updated" });
    } catch (e) {
      toast({ title: "Narration failed", description: e instanceof Error ? e.message : "error" });
    } finally { setBusy(null); }
  };

  const startRender = async () => {
    if (!project || busy) return;
    setBusy("render");
    try {
      const r = await fetch(`/api/cartoon/projects/${project.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "render" }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409) {
        // Expected when a render is already running — info, not an error.
        toast({ title: "Already running", description: d.message || "A render is already in progress — watch the progress bar below." });
      } else if (!r.ok) {
        toast({ title: "Could not start render", description: d.error || d.message || "error" });
      } else {
        toast({ title: "Render started", description: d.message });
      }
    } finally { setBusy(null); }
  };

  const deleteProject = async (id: string) => {
    const r = await fetch(`/api/cartoon/projects/${id}`, { method: "DELETE" });
    if (r.ok) { toast({ title: "Deleted" }); await loadProjects(); if (project?.id === id) { setProject(null); setSpec(null); setStep("topic"); } }
    else { const d = await r.json().catch(() => ({})); toast({ title: "Delete failed", description: d.error }); }
  };

  const openProject = async (id: string) => {
    const r = await fetch(`/api/cartoon/projects/${id}`);
    if (r.ok) {
      const p = (await r.json()).project as ProjectFull;
      setProject(p); setSpec(p.spec); setOrientation((p.orientation as Orientation) || "9:16");
      setSubtitles(p.subtitles);
      setStep(p.spec ? (p.status === "ready" ? "publish" : "script") : "script");
      if (p.status === "ready") void loadAsset(p.id);
    }
  };

  const loadAsset = async (pid: string) => {
    const r = await fetch("/api/cartoon/publish");
    if (r.ok) {
      const d = await r.json();
      const a = (d.assets as AssetRow[]).find((x) => x.projectId === pid) || null;
      setAsset(a);
    }
  };
  React.useEffect(() => { if (step === "publish" && project) void loadAsset(project.id); }, [step, project?.id, project]);

  // ---------- derived ----------
  const narration = project?.narration || {};
  const readyScenes = spec ? spec.scenes.filter((s) => narration[s.id]?.audioUrl).length : 0;
  const totalSec = spec ? spec.scenes.reduce((a, s) => a + sceneDuration(s, narration), 0) : 0;
  const working = project && ["scripting", "narrating", "rendering"].includes(project.status);
  const playerFrames = spec ? Math.max(30, Math.ceil(totalDuration({ spec, narration, orientation }) * 30)) : 30;

  const filteredKas = (overview?.knowledgeAssets || []).filter((k) =>
    !kaQuery.trim() || k.keyword.toLowerCase().includes(kaQuery.toLowerCase()) || k.subject.toLowerCase().includes(kaQuery.toLowerCase()));

  // ---------- render ----------
  const workingBanner = working && project && (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
      <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-amber-900">{project.stageMessage || "Working..."}</div>
        {(project.status === "rendering" || project.status === "narrating" || project.status === "scripting") && (
          <Progress value={Math.round(project.progress * 100)} className="mt-1.5 h-1.5" />
        )}
      </div>
      <Badge className={STATUS_TONE[project.status]}>{project.status}</Badge>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fbff]">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a73e8] text-lg font-black text-white">S</div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold leading-tight text-slate-900">Cartoon Animation Studio</h1>
            <p className="text-[11px] text-slate-500">Shiney Brain Academy · free-first 2D video engine</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {project && <Badge variant="outline" className="max-w-[280px] truncate">{project.title}</Badge>}
            <a href="/assets" className="rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Asset Library</a>
            <Button size="sm" variant="outline" onClick={() => { setProject(null); setSpec(null); setStep("topic"); }}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1 gap-4 px-4 py-4">
        {/* left rail */}
        <nav className="hidden w-[190px] shrink-0 md:block">
          <div className="sticky top-[70px] space-y-1">
            {STEP_LIST.map(({ key, label, icon: Icon }, i) => {
              const disabled = !project && key !== "topic" && key !== "library";
              return (
                <button key={key} disabled={disabled} onClick={() => setStep(key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors
                    ${step === key ? "bg-[#1a73e8] text-white shadow-sm" : "text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"}`}>
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  <span className={`text-[10px] ${step === key ? "text-blue-100" : "text-slate-400"}`}>{i + 1}</span>
                </button>
              );
            })}
            {workingBanner && <div className="mt-3">{workingBanner}</div>}
            {project && project.status === "ready" && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Video ready to publish
              </div>
            )}
            {project && project.status === "failed" && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0"><div>Production failed</div><div className="mt-0.5 whitespace-pre-wrap font-normal text-rose-700">{project.error?.slice(0, 200)}</div></div>
              </div>
            )}
          </div>
        </nav>

        {/* main */}
        <main className="min-w-0 flex-1">
          {/* mobile steps */}
          <div className="mb-3 flex gap-1.5 overflow-x-auto md:hidden">
            {STEP_LIST.map(({ key, label }) => (
              <button key={key} onClick={() => setStep(key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${step === key ? "bg-[#1a73e8] text-white" : "bg-white text-slate-600"}`}>{label}</button>
            ))}
          </div>

          {step === "topic" && (
            <TopicStep
              kas={filteredKas} query={kaQuery} setQuery={setKaQuery}
              selected={selectedKa} setSelected={setSelectedKa}
              customTopic={customTopic} setCustomTopic={setCustomTopic}
              orientation={orientation} setOrientation={setOrientation}
              subtitles={subtitles} setSubtitles={setSubtitles}
              onCreate={createProject} busy={busy === "create"}
            />
          )}

          {step === "script" && (
            <ScriptStep
              project={project} spec={spec} narration={narration} setSpec={setSpec}
              busy={busy} sceneIdx={sceneIdx} setSceneIdx={setSceneIdx}
              onPatch={patchProject} onRegenerateScript={regenerateScript} onRegenerateScene={regenerateScene}
            />
          )}

          {step === "cast" && (
            <CharacterStudio
              characters={overview?.characters || []}
              assignedRefs={new Set((spec?.scenes || []).flatMap((s) => s.cast.map((c) => c.ref)))}
              onSaved={(c) => {
                setOverview((o) => o ? { ...o, characters: [...o.characters.filter((x) => x.id !== c.id), c] } : o);
                toast({ title: "Character saved", description: `${c.name} is now available for every video.` });
              }}
            />
          )}

          {step === "audio" && (
            <AudioStep project={project} spec={spec} narration={narration} busy={busy} onRenarrate={renarrate} />
          )}

          {step === "render" && (
            <RenderStep project={project} spec={spec} orientation={orientation} subtitles={subtitles}
              setOrientation={setOrientation} setSubtitles={setSubtitles} onPatch={patchProject}
              onStartRender={startRender} narration={narration} />
          )}

          {step === "publish" && (
            <PublishStep project={project} spec={spec} asset={asset} onDone={loadAsset} />
          )}

          {step === "library" && (
            <LibraryStep projects={projects} onOpen={openProject} onDelete={deleteProject} />
          )}
        </main>

        {/* right preview rail */}
        <aside className="hidden w-[330px] shrink-0 xl:block">
          <div className="sticky top-[70px] space-y-3">
            <div className="rounded-xl border bg-white p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Film className="h-4 w-4 text-[#1a73e8]" /> Live preview</h3>
              {spec && spec.scenes.length > 0 ? (
                <div className="mx-auto" style={{ maxWidth: orientation === "9:16" ? 250 : orientation === "1:1" ? 300 : 300 }}>
                  <Player
                    ref={playerRef}
                    component={CartoonVideo}
                    inputProps={{ spec, narration, orientation, subtitles }}
                    durationInFrames={playerFrames}
                    compositionWidth={orientation === "9:16" ? 1080 : orientation === "1:1" ? 1080 : 1920}
                    compositionHeight={orientation === "9:16" ? 1920 : orientation === "1:1" ? 1080 : 1080}
                    fps={30}
                    style={{ width: "100%" }}
                    controls
                    loop
                    acknowledgeRemotionLicense
                  />
                </div>
              ) : (
                <div className="flex h-[380px] items-center justify-center rounded-lg bg-slate-50 text-center text-xs text-slate-400">
                  Preview appears here once a storyboard exists.
                </div>
              )}
              {spec && spec.scenes.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{spec.scenes.length} scenes · ~{Math.round(totalSec)}s</span>
                  <span>{readyScenes}/{spec.scenes.length} narrated</span>
                </div>
              )}
            </div>
            {project?.status === "ready" && project.videoUrl && (
              <div className="rounded-xl border bg-white p-3">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Play className="h-4 w-4 text-emerald-600" /> Final render</h3>
                <video src={project.videoUrl} controls className="w-full rounded-lg" style={{ maxHeight: 400 }} />
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{project.durationSeconds}s · {((project.videoSizeBytes || 0) / 1048576).toFixed(1)} MB</span>
                  <a href={project.videoUrl} download className="flex items-center gap-1 font-semibold text-[#1a73e8]"><Download className="h-3 w-3" /> Download</a>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="mt-auto border-t bg-white py-3 text-center text-[11px] text-slate-400">
        Cartoon Animation Studio · 100% free-stack (React · Remotion · SVG · z-ai TTS/LLM) · videos render server-side with zero paid credits
      </footer>
    </div>
  );
}

// ================= STEP: TOPIC =================
function TopicStep(p: {
  kas: KA[]; query: string; setQuery: (s: string) => void;
  selected: KA | null; setSelected: (k: KA | null) => void;
  customTopic: string; setCustomTopic: (s: string) => void;
  orientation: Orientation; setOrientation: (o: Orientation) => void;
  subtitles: boolean; setSubtitles: (b: boolean) => void;
  onCreate: () => void; busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-extrabold">1 · Pick what the cartoon teaches</h2>
        <p className="mt-0.5 text-sm text-slate-500">Knowledge Assets are the single source of truth — the studio never invents its own database.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Search Knowledge Assets</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={p.query} onChange={(e) => p.setQuery(e.target.value)} placeholder="Search by topic or subject..." className="pl-8" />
            </div>
          </div>
          <div>
            <Label className="text-xs">…or a custom topic</Label>
            <Input value={p.customTopic} onChange={(e) => p.setCustomTopic(e.target.value)} placeholder="e.g. Why the sky is blue"
              className="mt-1" onFocus={() => p.setSelected(null)} />
          </div>
        </div>
        <div className="mt-4 grid max-h-[300px] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {p.kas.map((k) => (
            <button key={k.id} onClick={() => { p.setSelected(k); p.setCustomTopic(""); }}
              className={`rounded-xl border p-3 text-left transition-all ${p.selected?.id === k.id ? "border-[#1a73e8] bg-blue-50 ring-2 ring-[#1a73e8]/20" : "bg-white hover:border-slate-300"}`}>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="text-[10px]">{k.subject}</Badge>
              </div>
              <div className="mt-1.5 text-sm font-bold leading-snug">{k.keyword}</div>
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{k.summary}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h3 className="text-sm font-bold">Video format</h3>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            {(["9:16", "16:9", "1:1"] as Orientation[]).map((o) => (
              <button key={o} onClick={() => p.setOrientation(o)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${p.orientation === o ? "border-[#1a73e8] bg-blue-50 text-[#1a73e8]" : "text-slate-600"}`}>
                {o} {o === "9:16" && <span className="ml-1 rounded bg-[#FFCC00] px-1 text-[9px] text-black">PRIORITY</span>}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={p.subtitles} onCheckedChange={p.setSubtitles} /> Burned-in subtitles
          </label>
          <Button onClick={p.onCreate} disabled={p.busy || (!p.selected && !p.customTopic.trim())}
            className="ml-auto bg-[#1a73e8] hover:bg-[#1557b0]">
            {p.busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />}
            Create cartoon
          </Button>
        </div>
      </div>
    </div>
  );
}

// ================= STEP: SCRIPT =================
function ScriptStep(p: {
  project: ProjectFull | null; spec: Storyboard | null; setSpec: (s: Storyboard | null) => void;
  narration: Record<string, { audioUrl: string }>; busy: string | null;
  sceneIdx: number; setSceneIdx: (i: number) => void;
  onPatch: (b: Record<string, unknown>) => Promise<unknown>;
  onRegenerateScript: () => void; onRegenerateScene: (id: string, instruction?: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Storyboard | null>(null);
  const [instrOpen, setInstrOpen] = React.useState(false);
  const [instr, setInstr] = React.useState("");

  React.useEffect(() => { if (!editing) setDraft(p.spec); }, [p.spec, editing]);

  if (!p.project) return <Empty text="Create a cartoon first." />;
  const spec = editing ? draft : p.spec;
  if (!spec) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#1a73e8]" />
        <p className="mt-3 text-sm font-semibold">{p.project.stageMessage || "Writing the storyboard..."}</p>
      </div>
    );
  }
  const scene = spec.scenes[Math.min(p.sceneIdx, spec.scenes.length - 1)];

  const updateScene = (patch: Partial<StoryboardScene>) => {
    if (!spec) return;
    const scenes = spec.scenes.map((s, i) => (i === p.sceneIdx ? { ...s, ...patch } : s));
    if (editing) setDraft({ ...spec, scenes });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input value={spec.title} onChange={(e) => setDraft({ ...spec, title: e.target.value })} className="text-lg font-bold" />
          ) : (
            <h2 className="truncate text-lg font-extrabold">{spec.title}</h2>
          )}
          <p className="text-[11px] text-slate-500">
            {p.project.knowledgeAsset ? `KA: ${p.project.knowledgeAsset.keyword}` : "Custom topic"} · edit anything, then Save & approve
          </p>
        </div>
        {editing ? (
          <>
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(p.spec); }}>Discard</Button>
            <Button size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={async () => {
              if (!draft) return;
              await p.onPatch({ spec: draft });
              setEditing(false);
            }}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Save & approve</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={p.project.status === "rendering"}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit script
            </Button>
            <Button size="sm" variant="outline" onClick={p.onRegenerateScript} disabled={!!p.busy || p.project.status === "rendering"}>
              {p.busy === "regen-script" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />} Fresh storyboard
            </Button>
            <Dialog open={instrOpen} onOpenChange={setInstrOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={!!p.busy || p.project.status === "rendering"}>
                  <Wand2 className="mr-1 h-3.5 w-3.5" /> Regenerate scene
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate “{scene?.heading}”</DialogTitle>
                </DialogHeader>
                <p className="text-xs text-slate-500">Optional creative direction — e.g. “make it funnier”, “show the blood cells closer”. Only this scene changes.</p>
                <Textarea value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Creative direction (optional)" rows={3} />
                <Button className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={() => { setInstrOpen(false); p.onRegenerateScene(scene.id, instr || undefined); setInstr(""); }}>
                  <Wand2 className="mr-1.5 h-4 w-4" /> Regenerate this scene
                </Button>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* scene tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {spec.scenes.map((s, i) => (
          <button key={s.id} onClick={() => p.setSceneIdx(i)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${i === p.sceneIdx ? "border-[#1a73e8] bg-[#1a73e8] text-white" : "bg-white text-slate-600"}`}>
            {i + 1}. {s.heading}
          </button>
        ))}
      </div>

      {scene && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3 rounded-xl border bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">Heading</Label>
                <Input className="mt-1 h-8 text-sm" value={scene.heading} disabled={!editing}
                  onChange={(e) => updateScene({ heading: e.target.value })} /></div>
              <div><Label className="text-xs">World (visual concept)</Label>
                <Select value={scene.visualConcept} disabled={!editing}
                  onValueChange={(v) => updateScene({ visualConcept: v as StoryboardScene["visualConcept"] })}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{VISUAL_CONCEPTS.map((c) => <SelectItem key={c} value={c} className="text-xs">{CONCEPT_LABELS[c]}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div><Label className="text-xs">Narration ({scene.narration.split(/\s+/).length} words)</Label>
              <Textarea className="mt-1 text-sm" rows={3} value={scene.narration} disabled={!editing}
                onChange={(e) => updateScene({ narration: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label className="text-xs">Camera</Label>
                <Select value={scene.camera} disabled={!editing} onValueChange={(v) => updateScene({ camera: v as StoryboardScene["camera"] })}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{["none", "zoom-in", "zoom-out", "pan-left", "pan-right"].map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs">Transition</Label>
                <Select value={scene.transition} disabled={!editing} onValueChange={(v) => updateScene({ transition: v as StoryboardScene["transition"] })}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{["fade", "slide", "wipe", "iris", "none"].map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs">Speech bubble</Label>
                <Input className="mt-1 h-8 text-sm" value={scene.onScreenText || ""} disabled={!editing} placeholder="(optional)"
                  onChange={(e) => updateScene({ onScreenText: e.target.value })} /></div>
            </div>
            {/* cast table */}
            <div>
              <Label className="text-xs">Characters in this scene</Label>
              <div className="mt-1 space-y-2">
                {scene.cast.map((c, ci) => (
                  <div key={ci} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-5">
                    <Select value={c.ref} disabled={!editing}
                      onValueChange={(v) => { const cast = [...scene.cast]; cast[ci] = { ...c, ref: v }; updateScene({ cast }); }}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{spec.characters.map((ch) => <SelectItem key={ch.ref} value={ch.ref} className="text-xs">{ch.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={c.action} disabled={!editing}
                      onValueChange={(v) => { const cast = [...scene.cast]; cast[ci] = { ...c, action: v as StoryboardScene["cast"][0]["action"] }; updateScene({ cast }); }}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={c.expression} disabled={!editing}
                      onValueChange={(v) => { const cast = [...scene.cast]; cast[ci] = { ...c, expression: v as StoryboardScene["cast"][0]["expression"] }; updateScene({ cast }); }}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{EXPRESSIONS.map((e2) => <SelectItem key={e2} value={e2} className="text-xs">{e2}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      x
                      <input type="range" min={130} max={870} value={c.x} disabled={!editing} className="w-full"
                        onChange={(e) => { const cast = [...scene.cast]; cast[ci] = { ...c, x: Number(e.target.value) }; updateScene({ cast }); }} />
                    </div>
                    <label className="flex items-center gap-1 text-[10px] font-semibold">
                      <Switch checked={c.speaking === true} disabled={!editing} className="scale-[0.7]"
                        onCheckedChange={(v) => { const cast = [...scene.cast]; cast[ci] = { ...c, speaking: v }; updateScene({ cast }); }} />
                      lipsync
                    </label>
                  </div>
                ))}
              </div>
            </div>
            {/* props */}
            <div>
              <Label className="text-xs">Props</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {scene.props.map((pr, pi) => (
                  <Badge key={pi} variant="secondary" className="gap-1">
                    {pr.kind}
                    {editing && (
                      <button onClick={() => updateScene({ props: scene.props.filter((_, j) => j !== pi) })} className="text-rose-500">×</button>
                    )}
                  </Badge>
                ))}
                {editing && (
                  <Select value="" onValueChange={(v) => { if (v) updateScene({ props: [...scene.props, { kind: v as StoryboardScene["props"][0]["kind"], x: 200, y: 660, scale: 0.8, popAt: 0 }] }); }}>
                    <SelectTrigger className="h-6 w-[130px] text-[11px]"><SelectValue placeholder="+ add prop" /></SelectTrigger>
                    <SelectContent>{PROP_KINDS.filter((k) => k !== "chair").map((k) => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border bg-white p-3">
            <h3 className="text-xs font-bold uppercase text-slate-400">Scene summary</h3>
            <div className="space-y-1 text-xs text-slate-600">
              <div>World: <b>{CONCEPT_LABELS[scene.visualConcept]}</b></div>
              <div>Cast: {scene.cast.map((c) => `${spec.characters.find((ch) => ch.ref === c.ref)?.name || c.ref} (${c.action}, ${c.expression})`).join(", ")}</div>
              <div>Duration: ~{Math.round(sceneDuration(scene, p.narration))}s</div>
              <div>Audio: {p.narration[scene.id] ? "ready" : "not generated yet"}</div>
            </div>
            <div className="rounded-lg bg-[#f8fbff] p-2 text-[11px] italic text-slate-500">“{scene.narration}”</div>
            {p.project && (
              <div className="border-t pt-2">
                <SceneAssetsPanel
                  projectId={p.project.id}
                  scene={scene}
                  onSpec={(s) => p.setSpec(s)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ================= STEP: AUDIO =================
function AudioStep(p: {
  project: ProjectFull | null; spec: Storyboard | null;
  narration: Record<string, { audioUrl: string; durationSeconds: number }>;
  busy: string | null; onRenarrate: (sceneId?: string) => void;
}) {
  if (!p.project || !p.spec) return <Empty text="Create a cartoon first." />;
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold">4 · Narration & audio</h2>
          <p className="text-sm text-slate-500">Per-scene narration with measured durations — lip-sync and subtitles sync to these files.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => p.onRenarrate()} disabled={!!p.busy}>
          {p.busy === "narr-all" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
          Re-narrate all
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {p.spec.scenes.map((s, i) => {
          const n = p.narration[s.id];
          const b = p.busy === `narr-${s.id}`;
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border p-2.5">
              <span className="w-6 text-center text-xs font-bold text-slate-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{s.heading}</div>
                <div className="truncate text-[11px] text-slate-500">{s.narration}</div>
              </div>
              {n ? (
                <>
                  <Badge variant="secondary">{n.durationSeconds.toFixed(1)}s</Badge>
                  <audio src={n.audioUrl} controls className="h-8 w-[220px]" />
                </>
              ) : (
                <Badge className="bg-amber-100 text-amber-800">no audio</Badge>
              )}
              <Button size="sm" variant="ghost" onClick={() => p.onRenarrate(s.id)} disabled={!!p.busy || p.project?.status === "rendering"}>
                {b ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Background music (“{p.spec.music}”) is a free synthesized loop layered automatically at low volume during render.
      </p>
    </div>
  );
}

// ================= STEP: RENDER =================
function RenderStep(p: {
  project: ProjectFull | null; spec: Storyboard | null;
  orientation: Orientation; subtitles: boolean;
  setOrientation: (o: Orientation) => void; setSubtitles: (b: boolean) => void;
  onPatch: (b: Record<string, unknown>) => Promise<unknown>;
  onStartRender: () => void;
  narration: Record<string, { audioUrl: string }>;
}) {
  if (!p.project) return <Empty text="Create a cartoon first." />;
  const rendering = p.project.status === "rendering";
  const ready = p.project.status === "ready" && p.project.videoUrl;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-extrabold">5 · Render the video</h2>
        <p className="text-sm text-slate-500">Frames are composed by the Remotion engine and encoded to H.264 MP4 — no paid cloud rendering.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            {(["9:16", "16:9", "1:1"] as Orientation[]).map((o) => (
              <button key={o} onClick={() => { p.setOrientation(o); void p.onPatch({ orientation: o }); }}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${p.orientation === o ? "border-[#1a73e8] bg-blue-50 text-[#1a73e8]" : "text-slate-600"}`}>{o}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={p.subtitles} onCheckedChange={(v) => { p.setSubtitles(v); void p.onPatch({ subtitles: v }); }} /> Subtitles
          </label>
          <Button onClick={p.onStartRender} disabled={rendering || !p.spec}
            className="ml-auto bg-[#1a73e8] hover:bg-[#1557b0]">
            {rendering ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-1.5 h-4 w-4" />}
            {rendering ? "Rendering..." : p.project.status === "failed" ? "Retry render" : "Render video"}
          </Button>
        </div>
        {rendering && (
          <div className="mt-3">
            <Progress value={Math.round(p.project.progress * 100)} className="h-2" />
            <p className="mt-1 text-xs text-slate-500">{p.project.stageMessage}</p>
          </div>
        )}
        {p.project.status === "failed" && (
          <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
            <b>Last render failed:</b>
            <div className="mt-1 whitespace-pre-wrap">{p.project.error?.slice(0, 400)}</div>
          </div>
        )}
      </div>
      {ready && (
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold">Render complete — {p.project.durationSeconds}s, {((p.project.videoSizeBytes || 0) / 1048576).toFixed(1)} MB</h3>
          </div>
          <video src={p.project.videoUrl!} controls className="mx-auto mt-3 max-h-[480px] rounded-lg" />
          <div className="mt-3 text-center">
            <a href={p.project.videoUrl!} download className="text-xs font-bold text-[#1a73e8] hover:underline">Download MP4</a>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= STEP: PUBLISH =================
function PublishStep(p: {
  project: ProjectFull | null; spec: Storyboard | null; asset: AssetRow | null;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/cartoon/publish").then((r) => r.json()).then((d) => setChannels(d.channels || [])).catch(() => {});
  }, []);

  if (!p.project || !p.spec) return <Empty text="Create a cartoon first." />;
  if (p.project.status !== "ready") {
    return <Empty text={`The video is not rendered yet (status: ${p.project.status}). Render it first — publishing refuses assets without a real video file.`} />;
  }

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/cartoon/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      toast({ title: body.action === "approve" ? "Queued for publishing" : "Published" });
      p.onDone();
    } catch (e) {
      toast({ title: "Publish action failed", description: e instanceof Error ? e.message : "error" });
    } finally { setBusy(false); }
  };

  const jobs = p.asset?.publishJobs || [];
  const platformIcon: Record<string, string> = { youtube: "▶", instagram: "◎", facebook: "f", tiktok: "♪", linkedin: "in", telegram: "✈", x: "𝕏" };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-extrabold">6 · Save & publish</h2>
        <p className="text-sm text-slate-500">The video is registered in the shared media library — the Social Engine sees it like any other engine’s output.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <Label className="text-[10px] uppercase text-slate-400">Caption (editable in Social Engine)</Label>
            <p className="mt-1 text-sm">{p.spec.caption}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {p.spec.hashtags.map((h) => <Badge key={h} variant="secondary" className="text-[10px]">{h}</Badge>)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <Label className="text-[10px] uppercase text-slate-400">Status</Label>
            <div className="mt-1 space-y-1 text-xs">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Video file exists ({((p.project.videoSizeBytes || 0) / 1048576).toFixed(1)} MB)</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Media library entry {p.asset ? "ready" : "creating..."}</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Knowledge Asset linked</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h3 className="text-sm font-bold">Connected channels</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {channels.filter((c) => c.isActive).map((c) => {
            const job = jobs.find((j) => j.channel.id === c.id);
            return (
              <label key={c.id} className={`flex items-center gap-3 rounded-lg border p-3 ${job ? "bg-slate-50" : "cursor-pointer hover:border-[#1a73e8]/40"}`}>
                <input type="checkbox" className="h-4 w-4 accent-[#1a73e8]" disabled={!!job || busy}
                  checked={job ? job.status === "published" || job.status === "queued" || job.status === "publishing" : picked.has(c.id)}
                  onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} />
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{platformIcon[c.platform] || c.platform[0]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.label}</div>
                  <div className="text-[10px] text-slate-500">{c.platform}{c.simulated ? " · sandbox channel" : ""}</div>
                </div>
                {job && (
                  <Badge className={job.status === "published" ? "bg-emerald-100 text-emerald-800" : job.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}>
                    {job.status}
                  </Badge>
                )}
              </label>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button disabled={busy || picked.size === 0}
            onClick={() => act({ action: "approve", contentAssetId: p.asset?.id, channelIds: Array.from(picked) })}
            className="bg-[#1a73e8] hover:bg-[#1557b0]">
            <Radio className="mr-1.5 h-4 w-4" /> Approve & queue ({picked.size})
          </Button>
          {jobs.filter((j) => j.status === "queued").map((j) => (
            <Button key={j.id} size="sm" variant="outline" disabled={busy}
              onClick={() => act({ action: "publish", jobId: j.id })}>
              <Share2 className="mr-1 h-3.5 w-3.5" /> Publish to {j.channel.platform} now
            </Button>
          ))}
        </div>
        {jobs.some((j) => j.lastError) && (
          <div className="mt-2 rounded-lg bg-rose-50 p-2 text-[11px] text-rose-700">{jobs.find((j) => j.lastError)?.lastError}</div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          Sandbox note: channels here are simulated adapters implementing the same contract as sbaskills’ Facebook/Instagram/YouTube/TikTok publishers — in production this button calls <code>lib/publish-engine.js</code> unchanged.
        </p>
      </div>
    </div>
  );
}

// ================= STEP: LIBRARY =================
function LibraryStep(p: { projects: ProjectRow[]; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h2 className="text-lg font-extrabold">Cartoon library</h2>
      <p className="text-sm text-slate-500">Every project and rendered video lives here.</p>
      <div className="mt-3 grid gap-2">
        {p.projects.length === 0 && <p className="text-sm text-slate-400">No projects yet — create your first cartoon from the Topic step.</p>}
        {p.projects.map((pr) => (
          <div key={pr.id} className="flex items-center gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{pr.title}</div>
              <div className="text-[11px] text-slate-500">
                {pr.knowledgeAsset ? pr.knowledgeAsset.keyword : pr.customTopic || "custom"} · {pr.orientation} · {new Date(pr.createdAt).toLocaleString()}
              </div>
              {(pr.status === "scripting" || pr.status === "narrating" || pr.status === "rendering") && (
                <Progress value={Math.round(pr.progress * 100)} className="mt-1.5 h-1" />
              )}
              {pr.status === "failed" && <div className="mt-1 truncate text-[11px] text-rose-600">{pr.error}</div>}
            </div>
            <Badge className={STATUS_TONE[pr.status] || "bg-slate-100"}>{pr.status}</Badge>
            {pr.videoUrl && (
              <video src={pr.videoUrl} className="h-12 rounded" muted onMouseEnter={(e) => void e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
            )}
            <Button size="sm" variant="outline" onClick={() => p.onOpen(pr.id)}><ChevronLeft className="h-3.5 w-3.5 rotate-180" /> Open</Button>
            <Button size="sm" variant="ghost" onClick={() => p.onDelete(pr.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed bg-white/60 text-sm text-slate-400">
      {text}
    </div>
  );
}
