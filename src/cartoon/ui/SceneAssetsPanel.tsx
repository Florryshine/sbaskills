"use client";
// Scene-level Shared Visual Asset Library panel for the Cartoon Studio.
// Lists what the auto-discovery attached, lets the admin re-run discovery
// for one scene, add library assets manually or detach them.
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Plus, X, Loader2, ImagePlus, Compass } from "lucide-react";
import type { Storyboard, StoryboardScene } from "../engine/types";

interface LibAsset { id: string; name: string; publicUrl: string; subject: string; category: string; source: string; license: string }

export function SceneAssetsPanel(p: {
  projectId: string;
  scene: StoryboardScene;
  onSpec: (s: Storyboard) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [libQ, setLibQ] = React.useState("");
  const [libAssets, setLibAssets] = React.useState<LibAsset[]>([]);
  const [picking, setPicking] = React.useState<Set<string>>(new Set());

  const attached = p.scene.customAssets || [];

  const post = async (body: Record<string, unknown>, tag: string) => {
    setBusy(tag);
    try {
      const r = await fetch(`/api/cartoon/projects/${p.projectId}/attach-assets`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: p.scene.id, ...body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      p.onSpec(d.spec);
      toast({ title: "Scene assets updated" });
      return true;
    } catch (e) {
      toast({ title: "Asset update failed", description: e instanceof Error ? e.message : "error" });
      return false;
    } finally { setBusy(null); }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    try {
      const r = await fetch("/api/assets?limit=48");
      const d = await r.json();
      setLibAssets(d.assets || []);
    } catch { /* dialog still usable */ }
  };

  const attachPicked = async () => {
    const ok = await post({ assetIds: Array.from(picking) }, "attach");
    if (ok) { setPicking(new Set()); setPickerOpen(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Library assets in this scene</span>
        <span className="text-[10px] text-slate-400">Shared Visual Asset Library</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {attached.length === 0 && (
          <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-400">
            None attached. Auto-discovery runs when the storyboard is created — re-run it or add from the library.
          </div>
        )}
        {attached.map((a) => (
          <div key={a.assetId} className="flex items-center gap-2 rounded-lg bg-slate-50 p-1.5">
            <img src={a.url} alt={a.name || "asset"} className="checker h-9 w-9 rounded border object-contain p-0.5" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-bold">{a.name || "Library asset"}</div>
              <div className="truncate text-[9px] text-slate-400">{a.license || "licence on file"}</div>
            </div>
            <button
              className="text-slate-400 hover:text-rose-500"
              disabled={busy !== null}
              onClick={() => void post({ removeAssetIds: [a.assetId] }, `rm-${a.assetId}`)}
            >
              {busy === `rm-${a.assetId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-7 text-[11px]"
          onClick={() => void post({ auto: true }, "auto")} disabled={busy !== null || attached.length >= 4}>
          {busy === "auto" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Compass className="mr-1 h-3 w-3" />}
          Auto-discover
        </Button>
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => void openPicker()} disabled={attached.length >= 4}>
              <ImagePlus className="mr-1 h-3 w-3" /> From library
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Add library assets to “{p.scene.heading}”</DialogTitle></DialogHeader>
            <Input value={libQ} onChange={(e) => setLibQ(e.target.value)} placeholder="Search the library…" className="h-8 text-sm" />
            <div className="grid max-h-[320px] grid-cols-4 gap-2 overflow-y-auto pt-1 sm:grid-cols-6">
              {libAssets
                .filter((a) => !libQ.trim() || a.name.toLowerCase().includes(libQ.toLowerCase()) || a.category.includes(libQ.toLowerCase()))
                .map((a) => {
                  const on = picking.has(a.id);
                  return (
                    <button key={a.id}
                      onClick={() => setPicking((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else if (n.size < 4) n.add(a.id); return n; })}
                      className={`rounded-lg border p-1 transition-all ${on ? "border-[#1a73e8] bg-blue-50 ring-2 ring-[#1a73e8]/20" : "hover:border-slate-300"}`}>
                      <img src={a.publicUrl} alt={a.name} className="checker h-[52px] w-full rounded object-contain" />
                      <div className="truncate text-[9px] font-semibold">{a.name}</div>
                    </button>
                  );
                })}
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{picking.size} selected</Badge>
              <Button size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" onClick={() => void attachPicked()} disabled={picking.size === 0 || busy !== null}>
                {busy === "attach" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                Attach to scene
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <a href="/assets" target="_blank" rel="noreferrer"
          className="inline-flex h-7 items-center rounded-lg border px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
          <Wand2 className="mr-1 h-3 w-3" /> Open Asset Library
        </a>
      </div>
    </div>
  );
}
