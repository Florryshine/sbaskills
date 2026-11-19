"use client";
// Cast & Character Studio: browse the SBA cast, build custom characters
// with live rig preview, save them for reuse across videos.
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, Save, Wand2 } from "lucide-react";
import { CharacterCanvas } from "./CharacterCanvas";
import { CharacterRig } from "../engine/characters/CharacterRig";
import { ACTIONS, EXPRESSIONS } from "../engine/types";
import type { CharacterDNA, Action, Expression } from "../engine/types";

export interface UICharacter {
  id: string; name: string; presetKey: string; isPreset: boolean; dna: CharacterDNA;
}

const HAIR_STYLES: CharacterDNA["hairStyle"][] = ["short-curls", "afro-puff", "braids", "buzz", "fade", "ponytail", "buns", "long", "headwrap"];
const OUTFITS: CharacterDNA["outfit"][] = ["hoodie", "tshirt", "dress", "pinafore", "lab-coat", "sports", "shirt-trousers", "skirt-blouse"];

const SKIN_TONES = ["#5e3419", "#6b3f22", "#7c4a2d", "#8a5a3b", "#91613e", "#a0714f", "#b07a52", "#c69070"];
const HAIR_COLORS = ["#0f0b08", "#171114", "#241a12", "#2b2118", "#3d2c1e", "#5b4636", "#8a5a2a", "#b8863b"];
const TOP_COLORS = ["#1a73e8", "#FFCC00", "#e8483f", "#57b85c", "#c25e8e", "#7a4dd8", "#ff8c42", "#4fb3a9", "#fafafa", "#274060"];
const BOTTOM_COLORS = ["#2c3a4d", "#33475b", "#3b2f8f", "#4d9de0", "#5b4636", "#7a4dd8", "#274060", "#8a2e26"];

export function CharacterStudio({ characters, onSaved, assignedRefs }: {
  characters: UICharacter[];
  onSaved: (c: UICharacter) => void;
  assignedRefs: Set<string>;
}) {
  const [selected, setSelected] = React.useState<UICharacter | null>(characters[0] || null);
  const [draft, setDraft] = React.useState<Partial<CharacterDNA>>(characters[0]?.dna || {});
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [previewExpr, setPreviewExpr] = React.useState<Expression>("happy");
  const [previewAction, setPreviewAction] = React.useState<Action>("wave");

  React.useEffect(() => {
    if (selected) { setDraft(selected.dna); setName(selected.isPreset ? selected.name : selected.name); }
  }, [selected]);

  const set = (k: keyof CharacterDNA, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cartoon/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), dna: draft, id: selected && !selected.isPreset ? selected.id : undefined }),
      });
      const data = await res.json();
      if (data.character) { onSaved(data.character); setSelected(data.character); }
    } finally { setSaving(false); }
  };

  const Swatches = ({ colors, value, onPick }: { colors: string[]; value?: string; onPick: (c: string) => void }) => (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)}
          className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? "border-[#1a73e8] ring-2 ring-[#1a73e8]/30" : "border-black/10"}`}
          style={{ background: c }} aria-label={c} />
      ))}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr_320px]">
      {/* cast list */}
      <div className="rounded-xl border bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">SBA Cast ({characters.length})</h3>
          <Badge variant="outline" className="text-[10px]">{assignedRefs.size} in video</Badge>
        </div>
        <ScrollArea className="h-[420px] pr-2">
          <div className="space-y-1.5">
            {characters.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)}
                className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-colors ${selected?.id === c.id ? "border-[#1a73e8] bg-blue-50" : "border-transparent hover:bg-slate-50"}`}>
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
                  <svg viewBox="0 0 400 680" className="h-full w-full translate-y-1">
                    <g transform="scale(0.55) translate(160 120)"><CharacterCanvasInline dna={c.dna} /></g>
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="text-[10px] text-slate-500">{c.isPreset ? "preset" : "custom"}</div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
        <Button size="sm" variant="outline" className="mt-2 w-full"
          onClick={() => { setSelected(null); setDraft({}); setName(""); }}>
          <UserPlus className="mr-1 h-3.5 w-3.5" /> New character
        </Button>
      </div>

      {/* live preview + expression/action tester */}
      <div className="flex flex-col items-center rounded-xl border bg-gradient-to-b from-sky-50 to-white p-4">
        <div className="flex min-h-[360px] items-end justify-center">
          <CharacterCanvas dna={draft} expression={previewExpr} action={previewAction} talking={previewAction === "talk"} width={230} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Select value={previewAction} onValueChange={(v) => setPreviewAction(v as Action)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={previewExpr} onValueChange={(v) => setPreviewExpr(v as Expression)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{EXPRESSIONS.map((e) => <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500">Live preview uses the exact same rig as the video engine.</p>
      </div>

      {/* DNA editor */}
      <ScrollArea className="h-[520px] rounded-xl border bg-white p-4">
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Character name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kemi" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Skin tone</Label>
            <Swatches colors={SKIN_TONES} value={draft.skin} onPick={(c) => set("skin", c)} />
          </div>
          <div>
            <Label className="text-xs">Hairstyle</Label>
            <Select value={draft.hairStyle || "short-curls"} onValueChange={(v) => set("hairStyle", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{HAIR_STYLES.map((h) => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Hair colour</Label>
            <Swatches colors={HAIR_COLORS} value={draft.hairColor} onPick={(c) => set("hairColor", c)} />
          </div>
          {draft.hairStyle === "headwrap" && (
            <div>
              <Label className="text-xs">Headwrap colour</Label>
              <Swatches colors={TOP_COLORS} value={draft.wrapColor} onPick={(c) => set("wrapColor", c)} />
            </div>
          )}
          <div>
            <Label className="text-xs">Outfit</Label>
            <Select value={draft.outfit || "hoodie"} onValueChange={(v) => set("outfit", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{OUTFITS.map((o) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Top colour</Label>
            <Swatches colors={TOP_COLORS} value={draft.topColor} onPick={(c) => set("topColor", c)} />
          </div>
          <div>
            <Label className="text-xs">Bottom colour</Label>
            <Swatches colors={BOTTOM_COLORS} value={draft.bottomColor} onPick={(c) => set("bottomColor", c)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["height", "headScale", "bodyWidth"] as const).map((k) => (
              <div key={k}>
                <Label className="text-[10px] uppercase text-slate-500">{k.replace("Scale", " size").replace("Width", " build")}</Label>
                <Slider value={[((draft[k] as number) ?? 1) * 100]} min={[88, 88, 82][["height", "headScale", "bodyWidth"].indexOf(k)]}
                  max={[114, 118, 118][["height", "headScale", "bodyWidth"].indexOf(k)]} step={1}
                  onValueChange={([v]) => set(k, v / 100)} className="mt-2" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5">
            {([["glasses", "Glasses"], ["earrings", "Earrings"], ["freckles", "Freckles"], ["blush", "Blush"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between text-xs font-medium">
                {label}
                <Switch checked={draft[k] === true} onCheckedChange={(v) => set(k, v)} className="scale-75" />
              </label>
            ))}
          </div>
          <Button onClick={save} disabled={saving || !name.trim()} className="w-full bg-[#1a73e8] hover:bg-[#1557b0]">
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving..." : selected && !selected.isPreset ? "Update character" : "Save to cast"}
          </Button>
          {selected?.isPreset && (
            <p className="text-center text-[11px] text-slate-500"><Wand2 className="mr-1 inline h-3 w-3" />Presets stay untouched — saving creates a new custom character.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// tiny inline non-animated preview for the list
function CharacterCanvasInline({ dna }: { dna: CharacterDNA }) {
  return (
    <CharacterRig dna={dna} expression="happy" action="idle" t={0.4} scale={1} x={200} y={620} blinkSeed={1} />
  );
}
