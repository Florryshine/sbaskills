'use client';

/**
 * SBA Musical Learning Studio — main studio interface.
 *
 * Full workflow: topic in -> AI lyrics -> preview & edit -> generate song
 * (singing + instrumental + mix) -> synchronized kinetic typography preview
 * -> export MP4/WebM/WAV or send straight to Social Post. Scripts persist on
 * the server (content_assets with asset_type 'music_video') so they survive
 * browser clears and can be reviewed/published/deleted per-video in the
 * Social Engine — deleting a video there keeps the script and the audio.
 * Gemini TTS and lyrics use the configured Gemini API key.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles, Music, Download, Film, Save, FolderOpen, Trash2,
  Wand2, Brain, RefreshCw, BookOpenText, AudioLines, UploadCloud,
} from 'lucide-react';
import StagePlayer from '@/components/studio/StagePlayer';
import LyricsEditor from '@/components/studio/LyricsEditor';
import SelfTestPanel from '@/components/studio/SelfTestPanel';
import { createBrowserClient } from '@/lib/supabase';
import {
  DEFAULT_SETTINGS, type AspectId, type BackgroundId, type GenreId, type MoodId,
  type SongSpec, type StudioSettings, type TypographyId, type VocalMode, type VocalStyle,
} from '@/lib/studio/types';
import { generateSong } from '@/lib/studio/pipeline';
import { listGenres } from '@/lib/studio/genres';
import { exportMp4, exportWebm, exportWav, webCodecsAvailable } from '@/lib/studio/exporter';

const GENRES = listGenres();

const GENRE_LABELS: Record<string, string> = Object.fromEntries(GENRES.map((g) => [g.id, g.label]));
GENRE_LABELS.auto = 'AI recommends';

const MOODS: Array<{ id: MoodId; label: string }> = [
  { id: 'upbeat', label: 'Upbeat' }, { id: 'happy', label: 'Happy' }, { id: 'groovy', label: 'Groovy' },
  { id: 'calm', label: 'Calm' }, { id: 'epic', label: 'Epic' }, { id: 'dreamy', label: 'Dreamy' },
];

const TYPOGRAPHY: Array<{ id: TypographyId; label: string }> = [
  { id: 'bounce', label: 'SBA Bounce' }, { id: 'letters', label: 'Letter Pop' }, { id: 'wave', label: 'Wave Flow' },
  { id: 'stretch', label: 'Groove Stretch' }, { id: 'neon', label: 'Neon Punch' }, { id: 'burst', label: 'Star Burst' },
];

const BACKGROUNDS: Array<{ id: BackgroundId; label: string }> = [
  { id: 'rays', label: 'Rays' }, { id: 'blobs', label: 'Color Blobs' }, { id: 'grid', label: 'Retro Grid' },
  { id: 'confetti', label: 'Confetti' }, { id: 'waves', label: 'Waves' }, { id: 'spotlight', label: 'Spotlight' },
];

const ASPECTS: Array<{ id: AspectId; label: string }> = [
  { id: '9:16', label: 'Vertical 9:16 (TikTok/Reels/Shorts)' },
  { id: '1:1', label: 'Square 1:1' },
  { id: '16:9', label: 'Landscape 16:9' },
];

/** A saved script row from /api/admin/music-studio/scripts (content_assets). */
interface ScriptRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  knowledge_assets?: { keyword?: string } | null;
  media_files?: Array<{ id: string; media_type: string; role: string; url: string; duration_seconds?: number | null }>;
  metadata?: {
    topic?: string;
    notes?: string;
    spec?: SongSpec;
    settings?: StudioSettings;
  };
}

export default function StudioPage() {
  const { toast } = useToast();

  /* ---------------- studio state ---------------- */
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [rawSpec, setRawSpec] = useState<SongSpec | null>(null);
  const [provider, setProvider] = useState<string>('');
  const [factChecked, setFactChecked] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [creativeNotes, setCreativeNotes] = useState<string>('');

  const [lyricsBusy, setLyricsBusy] = useState(false);
  const [songBusy, setSongBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);

  const [timeline, setTimeline] = useState<Parameters<typeof StagePlayer>[0]['timeline']>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [exportPct, setExportPct] = useState(0);
  const [ttsAvailable, setTtsAvailable] = useState<boolean | null>(null);

  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [currentScriptId, setCurrentScriptId] = useState<string | null>(null);
  const [savingScript, setSavingScript] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');
  const [mp4Ready, setMp4Ready] = useState(false);
  const [backgroundJobs, setBackgroundJobs] = useState<Array<{ id: string; title: string; status: string; stage: string; stage_message: string | null; progress: number; video_url: string | null; audio_url: string | null; error_message: string | null; created_at: string }>>([]);
  const [queueBusy, setQueueBusy] = useState(false);

  const audioUrlRef = useRef<string | null>(null);
  const timelineRef = useRef<Parameters<typeof StagePlayer>[0]['timeline']>(null);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  // Automated-verification hook (also handy for debugging in DevTools).
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__sbaStudio = {
      getTimeline: () => timelineRef.current,
      getAudio: () => audioBufferRef.current,
      exportMp4,
      exportWebm,
    };
  }, []);

  useEffect(() => {
    fetch('/api/admin/music-studio/tts')
      .then((r) => r.json())
      .then((j) => {
        const available = Boolean(j.available);
        setTtsAvailable(available);
        if (available) setSettings((current) => ({ ...current, vocalMode: 'tts' }));
      })
      .catch(() => setTtsAvailable(false));
    setMp4Ready(webCodecsAvailable());
    loadScripts();
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const setSetting = <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  /* ---------------- Step 1: lyrics ---------------- */
  const generateLyrics = useCallback(async () => {
    if (!topic.trim()) {
      toast({ title: 'Enter a topic first', description: 'Example: The stages of mitosis' });
      return;
    }
    setLyricsBusy(true);
    setWarnings([]);
    setProgressMsg('Thinking about your topic…');
    try {
      const requestSettings = {
        ...settings,
        seedMelody: Math.floor(Math.random() * 1000000000),
        seedArrangement: Math.floor(Math.random() * 1000000000),
      };
      setSettings(requestSettings);
      const res = await fetch('/api/admin/music-studio/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, notes, genre: settings.genre, mood: settings.mood, durationSec: settings.durationSec, settings: requestSettings }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Lyrics request failed' }));
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      const j = await res.json() as { spec: SongSpec; provider: string; lyricSource?: 'ai' | 'template'; factCheck?: { checked: boolean }; warnings?: string[] };
      setRawSpec(j.spec);
      setProvider(j.lyricSource === 'template' || j.provider === 'fallback' ? 'template lyrics (not AI)' : 'AI-generated');
      setFactChecked(Boolean(j.factCheck?.checked));
      setWarnings(j.warnings ?? []);
      setCreativeNotes(j.spec.creativeNotes ?? '');
      toast({
        title: j.lyricSource === 'template' || j.provider === 'fallback' ? 'Template lyrics (AI unavailable)' : 'AI lyrics ready',
        description: j.lyricSource === 'template' || j.provider === 'fallback'
          ? 'Gemini could not be reached, so these are template lyrics, not original AI lyrics. See the warning below, then press Regenerate.'
          : 'Original AI lyrics. Edit them below before generating the song.',
      });
    } catch (e) {
      toast({ title: 'Could not generate lyrics', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setLyricsBusy(false);
      setProgressMsg('');
    }
  }, [topic, notes, settings, toast]);

  /* ---------------- Step 2: song ---------------- */
  const renderCurrentSpec = useCallback(async (spec: SongSpec, s: StudioSettings, msg: string) => {
    setSongBusy(true);
    setProgressMsg(msg);
    setProgressPct(5);
    try {
      const result = await generateSong(spec, {
        settings: s,
        onProgress: (m, p) => { setProgressMsg(m); setProgressPct(p); },
      });
      audioBufferRef.current = result.audio;
      const blobWav = exportWav(result.audio);
      const url = URL.createObjectURL(blobWav);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      setAudioUrl(url);
      setTimeline(result.timeline);
      if (result.warnings.length) setWarnings((w) => [...w, ...result.warnings]);
      setProgressMsg('Song ready — press play!');
      setProgressPct(100);
      toast({ title: 'Song generated', description: `${result.timeline.sections.length} sections · ${result.durationSec.toFixed(0)}s · ${result.usedTts ? 'AI voice pitch-mapped to the melody' : 'built-in synthetic vocals'} + instrumental mixed.` });
    } catch (e) {
      setProgressMsg('');
      toast({ title: 'Song generation failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSongBusy(false);
    }
  }, [toast]);

  const generateSongAction = useCallback(async () => {
    if (!rawSpec) return;
    await renderCurrentSpec(rawSpec, settings, 'Generating your song…');
  }, [rawSpec, settings, renderCurrentSpec]);

  /* ---------------- Regeneration ---------------- */
  const regenerateMelody = () => {
    if (!rawSpec) return;
    const s = { ...settings, seedMelody: Math.floor(Math.random() * 1e8) };
    setSettings(s);
    void renderCurrentSpec(rawSpec, s, 'Composing a new melody…');
  };
  const regenerateInstrumental = () => {
    if (!rawSpec) return;
    const s = { ...settings, seedArrangement: Math.floor(Math.random() * 1e8) };
    setSettings(s);
    void renderCurrentSpec(rawSpec, s, 'Rearranging the instrumental…');
  };
  const regenerateLyrics = () => { void generateLyrics(); };

  /* ---------------- Export ---------------- */
  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const slug = (rawSpec?.title ?? 'sba-song').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const doExportMp4 = async () => {
    if (!timeline || !audioBufferRef.current) return;
    if (!webCodecsAvailable()) {
      toast({ title: 'MP4 not supported here', description: 'Use Chrome or Edge for one-click MP4, or export WebM below (also uploadable).' });
      return;
    }
    setExporting(true);
    setExportPct(0);
    try {
      const { blob } = await exportMp4(timeline, audioBufferRef.current, { typography: settings.typography, background: settings.background }, {
        fps: 30, aspect: settings.aspect,
        onProgress: (p, s) => { setExportPct(p); setExportMsg(s); },
      });
      downloadBlob(blob, `${slug}.mp4`);
      toast({ title: 'MP4 exported', description: 'Synchronized music video downloaded.' });
    } catch (e) {
      toast({ title: 'MP4 export failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setExporting(false);
      setExportMsg('');
    }
  };

  const doExportWebm = async () => {
    if (!timeline || !audioBufferRef.current) return;
    setExporting(true);
    setExportPct(0);
    try {
      const { blob } = await exportWebm(timeline, audioBufferRef.current, { typography: settings.typography, background: settings.background }, {
        fps: 30, aspect: settings.aspect,
        onProgress: (p, s) => { setExportPct(p); setExportMsg(s); },
      });
      downloadBlob(blob, `${slug}.webm`);
      toast({ title: 'WebM exported', description: 'Recorded in realtime — keep this tab visible while recording.' });
    } catch (e) {
      toast({ title: 'WebM export failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setExporting(false);
      setExportMsg('');
    }
  };

  const doExportWav = () => {
    if (!audioBufferRef.current) return;
    downloadBlob(exportWav(audioBufferRef.current), `${slug}.wav`);
  };

  /* ---------------- Scripts (server persistence) ---------------- */
  const loadScripts = useCallback(async () => {
    setScriptsLoading(true);
    try {
      const res = await fetch('/api/admin/music-studio/scripts');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load saved scripts');
      setScripts(json.data ?? []);
    } catch (e) {
      toast({ title: 'Saved scripts unavailable', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setScriptsLoading(false);
    }
  }, [toast]);

  const loadBackgroundJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/music-studio/jobs', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setBackgroundJobs(json.jobs ?? []);
    } catch { /* A temporary polling failure must not interrupt studio work. */ }
  }, []);

  useEffect(() => {
    void loadBackgroundJobs();
    const timer = window.setInterval(() => { void loadBackgroundJobs(); }, 8000);
    return () => window.clearInterval(timer);
  }, [loadBackgroundJobs]);

  /** Save (create or update) the current script on the server. Returns its id. */
  const saveScript = useCallback(async (): Promise<string | null> => {
    if (!rawSpec) return null;
    setSavingScript(true);
    try {
      const res = await fetch('/api/admin/music-studio/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentScriptId, title: rawSpec.title, topic: topic || rawSpec.topic, notes, spec: rawSpec, settings }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save the script');
      const id = json.script?.id as string;
      setCurrentScriptId(id);
      void loadScripts();
      toast({ title: currentScriptId ? 'Script updated' : 'Script saved', description: `${json.script?.title ?? rawSpec.title} — stored on the server, ready for Social Post.` });
      return id;
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
      return null;
    } finally {
      setSavingScript(false);
    }
  }, [rawSpec, currentScriptId, topic, notes, settings, toast, loadScripts]);

  const startBackgroundRender = useCallback(async () => {
    if (!rawSpec || queueBusy) return;
    setQueueBusy(true);
    try {
      const scriptId = await saveScript();
      if (!scriptId) throw new Error('Save the song script before starting background rendering.');
      const res = await fetch('/api/admin/music-studio/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentAssetId: scriptId,
          title: rawSpec.title || 'SBA learning song',
          topic: topic || rawSpec.topic || 'Learning song',
          spec: rawSpec,
          settings,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not queue background rendering.');
      await loadBackgroundJobs();
      toast({ title: 'Background render queued', description: 'You can close this page. The song will continue rendering on the server.' });
    } catch (e) {
      toast({ title: 'Could not start background render', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setQueueBusy(false);
    }
  }, [rawSpec, queueBusy, currentScriptId, saveScript, topic, settings, loadBackgroundJobs, toast]);

  const openScript = (row: ScriptRow) => {
    const spec = row.metadata?.spec;
    if (!spec) {
      toast({ title: 'This script has no song data', description: 'It was saved before the studio stored specs. Re-generate the lyrics and save again.', variant: 'destructive' });
      return;
    }
    setRawSpec(spec);
    if (row.metadata?.settings) setSettings(row.metadata.settings);
    setTopic(row.metadata?.topic ?? spec.topic ?? '');
    setNotes(row.metadata?.notes ?? '');
    setCurrentScriptId(row.id);
    setProvider('saved script');
    setScriptsOpen(false);
    void renderCurrentSpec(spec, row.metadata?.settings ?? settings, 'Loading saved script…');
  };

  const deleteScript = async (row: ScriptRow) => {
    if (!confirm(`Delete the script "${row.title}" and its exported video/audio? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/music-studio/scripts?id=${row.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      if (currentScriptId === row.id) setCurrentScriptId(null);
      void loadScripts();
      toast({ title: 'Script deleted', description: row.title });
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  /* ---------------- Social Post publishing ---------------- */
  /** Upload an exported blob to Supabase storage and attach it to the script. */
  const uploadToSocial = useCallback(async (
    scriptId: string,
    blob: Blob,
    kind: 'video' | 'audio',
    ext: string,
    durationSeconds?: number,
  ): Promise<void> => {
    const prepare = await fetch('/api/admin/music-studio/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentAssetId: scriptId, kind, ext }),
    });
    const prepared = await prepare.json();
    if (!prepare.ok) throw new Error(prepared.error || 'Could not prepare the upload');

    const supabase = createBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from(prepared.bucket)
      .uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: blob.type || (kind === 'audio' ? 'audio/wav' : 'video/mp4'), upsert: false });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const complete = await fetch('/api/admin/music-studio/publish-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentAssetId: scriptId,
        kind,
        path: prepared.path,
        durationSeconds,
        fileSizeBytes: blob.size,
        autoPublish: false, // reviewed by hand in Social Post first
      }),
    });
    const done = await complete.json();
    if (!complete.ok) throw new Error(done.error || 'Could not attach the file to Social Post');
    void loadScripts();
  }, [loadScripts]);

  const sendCurrentToSocial = useCallback(async (blob: Blob | null, ext: string, durationSec?: number) => {
    if (!rawSpec) return;
    setPublishing(true);
    setPublishMsg('Saving the script…');
    try {
      const scriptId = currentScriptId ?? await saveScript();
      if (!scriptId) throw new Error('Save the script first, then try again.');

      if (blob) {
        setPublishMsg(`Uploading ${ext.toUpperCase()} to Social Post…`);
        await uploadToSocial(scriptId, blob, 'video', ext, durationSec);
      }
      // The mixed audio is stored alongside the video so it survives video
      // deletion and can be re-listened to or re-mixed later.
      if (audioBufferRef.current) {
        setPublishMsg('Uploading the audio mix…');
        await uploadToSocial(scriptId, exportWav(audioBufferRef.current), 'audio', 'wav', audioBufferRef.current.duration);
      }
      setPublishMsg('');
      toast({
        title: blob ? 'Sent to Social Post' : 'Script sent to Social Post',
        description: 'Preview it in Admin → Publishing → Social Engine. Deleting the video there keeps this script and the audio.',
      });
    } catch (e) {
      setPublishMsg('');
      toast({ title: 'Social Post upload failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  }, [rawSpec, currentScriptId, saveScript, uploadToSocial, toast]);

  const doSendMp4ToSocial = async () => {
    if (!timeline || !audioBufferRef.current) return;
    if (!webCodecsAvailable()) {
      toast({ title: 'MP4 not supported here', description: 'Use Chrome or Edge to export MP4, or send the WebM version instead.' });
      return;
    }
    setPublishing(true);
    setPublishMsg('Rendering the MP4…');
    try {
      const { blob } = await exportMp4(timeline, audioBufferRef.current, { typography: settings.typography, background: settings.background }, {
        fps: 30, aspect: settings.aspect,
        onProgress: (p, s) => { setExportPct(p); setExportMsg(s); setPublishMsg(`Rendering the MP4… ${p}%`); },
      });
      setExportPct(0);
      await sendCurrentToSocial(blob, 'mp4', timeline.durationSec + 1.6);
    } catch (e) {
      setPublishMsg('');
      toast({ title: 'Social Post upload failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setPublishing(false);
      setExportMsg('');
    }
  };

  const doSendWebmToSocial = async () => {
    if (!timeline || !audioBufferRef.current) return;
    setPublishing(true);
    setPublishMsg('Recording the WebM in realtime…');
    try {
      const { blob } = await exportWebm(timeline, audioBufferRef.current, { typography: settings.typography, background: settings.background }, {
        fps: 30, aspect: settings.aspect,
        onProgress: (p, s) => { setExportPct(p); setExportMsg(s); setPublishMsg(`Recording the WebM… ${p}%`); },
      });
      setExportPct(0);
      await sendCurrentToSocial(blob, 'webm', timeline.durationSec + 1.6);
    } catch (e) {
      setPublishMsg('');
      toast({ title: 'Social Post upload failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setPublishing(false);
      setExportMsg('');
    }
  };

  /* ---------------- render ---------------- */
  const songReady = Boolean(timeline && audioUrl);
  const lyricsReady = Boolean(rawSpec);

  return (
    <main className="min-h-screen bg-[#EAF3FF] text-[#12345B]">
      <Toaster />
      {/* subtle SBA gradient glow */}
      <div className="pointer-events-none fixed inset-0 opacity-60"
        style={{ background: 'radial-gradient(1200px 500px at 50% -10%, rgba(26,115,232,0.12), transparent), radial-gradient(800px 400px at 90% 20%, rgba(255,204,0,0.12), transparent)' }} />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        {/* ---------------- header ---------------- */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFD60A] to-[#FFCC00] text-[#062B59] shadow-lg">
              <Brain className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">
                SBA Musical Learning Studio
              </h1>
              <p className="text-xs text-[#526B89] sm:text-sm">
                Shiney Brain Academy — turn any lesson into a sung learning video
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={scriptsOpen} onOpenChange={(open) => { setScriptsOpen(open); if (open) void loadScripts(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-[#B8D1EF] bg-white">
                  <FolderOpen className="h-4 w-4 mr-1.5" /> Scripts
                  {scripts.length > 0 && <Badge className="ml-1.5 bg-[#FFD60A] text-[#062B59]">{scripts.length}</Badge>}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-[#C8DDF5] text-[#12345B]">
                <DialogHeader><DialogTitle>Saved scripts</DialogTitle>
                  <DialogDescription className="text-[#526B89]">
                    Stored on the server and visible in Social Post. Opening re-renders the song; deleting removes the script and its exported media.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[340px] [&>[data-radix-scroll-area-viewport]]:max-h-[340px]">
                  {scriptsLoading && <p className="text-sm text-[#637B98]">Loading…</p>}
                  {!scriptsLoading && scripts.length === 0 && <p className="text-sm text-[#637B98]">No saved scripts yet — press Save to store one.</p>}
                  <div className="space-y-2">
                    {scripts.map((row) => {
                      const hasVideo = (row.media_files ?? []).some((m) => m.media_type === 'video');
                      const hasAudio = (row.media_files ?? []).some((m) => m.media_type === 'audio');
                      return (
                        <div key={row.id} className="flex items-center justify-between rounded-lg border border-[#D8E6F5] bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{row.title}</p>
                            <p className="text-[11px] text-[#637B98]">
                              {new Date(row.updated_at).toLocaleString()} · {row.status}
                              {hasVideo && ' · video ready'}
                              {hasAudio && ' · audio saved'}
                              {!hasVideo && ' · no video yet'}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => openScript(row)} disabled={!row.metadata?.spec}>Open</Button>
                            <Button size="icon" variant="ghost" aria-label={`Delete script ${row.title}`} onClick={() => void deleteScript(row)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={() => void saveScript()} disabled={!lyricsReady || savingScript} className="border-[#B8D1EF] bg-white">
              <Save className="h-4 w-4 mr-1.5" /> {savingScript ? 'Saving…' : 'Save'}
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-[#B8D1EF] bg-white">
                  <BookOpenText className="h-4 w-4 mr-1.5" /> How it works
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-[#C8DDF5] text-[#12345B] max-w-lg">
                <DialogHeader><DialogTitle>How the studio works</DialogTitle>
                  <DialogDescription className="text-[#526B89]">The pipeline behind every generated song</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm text-[#304F73]">
                  <p><b className="text-[#0B5BC1]">1. AI lyric brain</b> — your topic goes through the AI provider (Gemini when configured, offline curriculum brain otherwise) which writes accurate lyrics, facts, chords, genre, tempo and mood. A second AI pass fact-checks the content.</p>
                  <p><b className="text-[#0B5BC1]">2. Melody finalizer</b> — every syllable gets a melody note: chord tones on strong beats, a repeated motif per section for catchiness, and a safe vocal range. This guarantees anything the AI writes can actually be sung.</p>
                  <p><b className="text-[#0B5BC1]">3. Singing engine</b> — Gemini TTS or the configured SBA voice engine speaks each lyric syllable, then the studio pitch-maps it onto the melody so the animated words are heard in tune. If no voice engine is available, the built-in synthetic singer is used as a fallback.</p>
                  <p><b className="text-[#0B5BC1]">4. Composer</b> — a genre template (Afrobeats, Amapiano, Hip-hop, Reggae, Gospel…) synthesizes drums, bass, chords and leads from scratch, with intro, drops, fills and outro.</p>
                  <p><b className="text-[#0B5BC1]">5. Mixer</b> — vocals and instruments render offline through buses, compression, delay and reverb into one finished song, faster than realtime.</p>
                  <p><b className="text-[#0B5BC1]">6. Kinetic typography</b> — the same timeline drives every word, letter, bounce and background transition on canvas, so words land exactly on the beat.</p>
                  <p><b className="text-[#0B5BC1]">7. Export & Social Post</b> — Local MP4/WebM/WAV exports remain available. Render in background queues a server-side MP4 that continues after you leave the page. "Send to Social Post" stores the script, video and audio on the server for preview and publishing in the Social Engine.</p>
                  <p className="text-xs text-[#637B98]">The instrumental and video render in your browser. Gemini TTS uses your existing Gemini API key and is subject to its free-tier quotas or account billing; no separate singing server is required.</p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* ---------------- body ---------------- */}
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
          {/* ============ LEFT: creative controls ============ */}
          <section aria-label="Creative controls" className="space-y-4 rounded-2xl border border-[#D8E6F5] bg-white p-4 backdrop-blur">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#0B5BC1]">
              <Wand2 className="h-4 w-4" /> 1 · The Lesson
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="topic">Topic or lesson</Label>
              <Input id="topic" placeholder="e.g. The stages of mitosis" value={topic}
                onChange={(e) => setTopic(e.target.value)} className="bg-white border-[#C8DDF5]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Educational notes or facts (optional)</Label>
              <Textarea id="notes" rows={3} placeholder="Paste the facts the song must teach…" value={notes}
                onChange={(e) => setNotes(e.target.value)} className="bg-white border-[#C8DDF5] text-sm" />
            </div>

            <Separator className="bg-[#D8E6F5]" />
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#0B5BC1]">
              <AudioLines className="h-4 w-4" /> 2 · The Sound
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Genre</Label>
                <Select value={settings.genre} onValueChange={(v) => setSetting('genre', v as GenreId | 'auto')}>
                  <SelectTrigger className="bg-white border-[#C8DDF5]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-[#C8DDF5] text-[#12345B] max-h-72">
                    <SelectItem value="auto">AI recommends</SelectItem>
                    {GENRES.map((g) => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mood</Label>
                <Select value={settings.mood} onValueChange={(v) => setSetting('mood', v as MoodId)}>
                  <SelectTrigger className="bg-white border-[#C8DDF5]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-[#C8DDF5] text-[#12345B]">
                    {MOODS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select value={String(settings.durationSec)} onValueChange={(v) => setSetting('durationSec', Number(v) as 30 | 45 | 60 | 90)}>
                  <SelectTrigger className="bg-white border-[#C8DDF5]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-[#C8DDF5] text-[#12345B]">
                    {[30, 45, 60, 90].map((d) => <SelectItem key={d} value={String(d)}>{d} seconds</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vocal</Label>
                <Select value={settings.vocalMode} onValueChange={(v) => setSetting('vocalMode', v as VocalMode)}>
                  <SelectTrigger className="bg-white border-[#C8DDF5]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-[#C8DDF5] text-[#12345B]">
                    <SelectItem value="synth">Built-in synthetic singer</SelectItem>
                    <SelectItem value="tts">Voice-engine pitch-mapped singer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Voice style</Label>
                <Select value={settings.vocalStyle} onValueChange={(v) => setSetting('vocalStyle', v as VocalStyle)}>
                  <SelectTrigger className="bg-white border-[#C8DDF5]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-[#C8DDF5] text-[#12345B]">
                    <SelectItem value="bright">Bright</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="choir">Choir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tempo <span className="text-[#637B98]">({settings.tempoOverride ?? 'auto'} bpm)</span></Label>
                <div className="pt-2.5">
                  <Slider min={70} max={130} step={1} value={[settings.tempoOverride ?? 100]}
                    onValueChange={(v) => setSetting('tempoOverride', v[0] === 100 ? null : v[0])} />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Music intensity <span className="text-[#637B98]">{Math.round(settings.musicIntensity * 100)}%</span></Label>
              <Slider min={0.1} max={1} step={0.05} value={[settings.musicIntensity]}
                onValueChange={(v) => setSetting('musicIntensity', v[0])} />
            </div>
            {settings.vocalMode === 'tts' && ttsAvailable === true && (
              <p className="text-[11px] text-[#526B89]">
                SBA's existing Nigerian Edge TTS voice is used first; Gemini 3.8 TTS is the fallback. The spoken lyric syllables are pitch-mapped to the melody. Gemini fallback usage follows your account's free-tier quota or billing.
              </p>
            )}
            {settings.vocalMode === 'synth' && (
              <p className="text-[11px] text-[#526B89]">
                Built-in singer is an experimental synthetic voice, not a natural human singer. It follows the lyric melody but may sound robotic. Add GEMINI_API_KEY or configure SBA_TTS_URL to enable intelligible pitch-mapped voice vocals.
              </p>
            )}
            {settings.vocalMode === 'tts' && ttsAvailable === false && (
              <p className="text-[11px] text-[#0B5BC1]/80">
                TTS-Map needs a TTS engine. This host has none, so the built-in synth singer will be used.
                Add GEMINI_API_KEY or configure SBA_TTS_URL to enable pitch-mapped voice vocals.
              </p>
            )}

            <Separator className="bg-white" />
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#0B5BC1]">
              <Film className="h-4 w-4" /> 3 · The Video
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Typography</Label>
                <Select value={settings.typography} onValueChange={(v) => setSetting('typography', v as TypographyId)}>
                  <SelectTrigger className="bg-white border-[#C8DDF5]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-[#C8DDF5] text-[#12345B]">
                    {TYPOGRAPHY.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Background</Label>
                <Select value={settings.background} onValueChange={(v) => setSetting('background', v as BackgroundId)}>
                  <SelectTrigger className="bg-white border-[#C8DDF5]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-[#C8DDF5] text-[#12345B]">
                    {BACKGROUNDS.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Aspect ratio</Label>
              <Select value={settings.aspect} onValueChange={(v) => setSetting('aspect', v as AspectId)}>
                <SelectTrigger className="bg-white border-[#C8DDF5]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white border-[#C8DDF5] text-[#12345B]">
                  {ASPECTS.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-[#7188A4]">
              Typography & background changes apply live to the preview and to the exported video — no re-render needed.
            </p>
          </section>

          {/* ============ CENTER: stage ============ */}
          <section aria-label="Stage" className="space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Button onClick={generateLyrics} disabled={lyricsBusy} className="bg-[#FFCC00] hover:bg-[#FFE066] text-[#062B59] font-semibold shadow-lg shadow-blue-950/20">
                <Sparkles className="h-4 w-4 mr-1.5" /> {lyricsBusy ? 'Writing…' : 'Generate Lyrics'}
              </Button>
              <Button onClick={generateSongAction} disabled={!lyricsReady || songBusy}
                className="bg-[#1A73E8] hover:bg-[#2B82E8] text-white font-semibold shadow-lg shadow-blue-950/20">
                <Music className="h-4 w-4 mr-1.5" /> {songBusy ? 'Producing…' : 'Generate Song'}
              </Button>
            </div>
            {(lyricsBusy || songBusy || progressMsg) && (
              <div className="mx-auto max-w-xl space-y-1.5">
                <Progress value={Math.max(progressPct, lyricsBusy ? 15 : 0)} className="h-2" />
                <p className="text-center text-xs text-[#526B89]">{progressMsg}</p>
              </div>
            )}

            <div className="flex justify-center">
              <StagePlayer
                timeline={timeline ?? null}
                audioUrl={audioUrl}
                style={{ typography: settings.typography, background: settings.background }}
                aspect={settings.aspect}
                playing={playing}
                onPlayingChange={setPlaying}
                busy={songBusy || exporting}
              />
            </div>

            {/* regeneration */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={regenerateLyrics} disabled={!lyricsReady || lyricsBusy} className="border-[#B8D1EF] bg-white">
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> New lyrics
              </Button>
              <Button size="sm" variant="outline" onClick={regenerateMelody} disabled={!lyricsReady || songBusy} className="border-[#B8D1EF] bg-white">
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> New melody
              </Button>
              <Button size="sm" variant="outline" onClick={regenerateInstrumental} disabled={!lyricsReady || songBusy} className="border-[#B8D1EF] bg-white">
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> New instrumental
              </Button>
            </div>

            {/* export */}
            <div className="rounded-2xl border border-[#D8E6F5] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#0B5BC1]">Export</h3>
                <span className="text-[11px] text-[#7188A4]">
                  {mp4Ready ? 'MP4 encoder ready in this browser' : 'MP4 needs Chrome/Edge — WebM works everywhere'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={doExportMp4} disabled={!songReady || exporting || publishing} className="bg-[#FFCC00] text-[#062B59] font-semibold hover:bg-[#FFE066]">
                  <Download className="h-4 w-4 mr-1.5" /> Video MP4
                </Button>
                <Button size="sm" variant="secondary" onClick={doExportWebm} disabled={!songReady || exporting || publishing}>Video WebM</Button>
                <Button size="sm" variant="secondary" onClick={doExportWav} disabled={!songReady || exporting || publishing}>Audio WAV</Button>
                <Button size="sm" onClick={() => void startBackgroundRender()} disabled={!lyricsReady || queueBusy || savingScript} className="bg-[#0B5BC1] text-white hover:bg-[#084A9E]">
                  <UploadCloud className="h-4 w-4 mr-1.5" /> {queueBusy ? 'Queueing…' : 'Render in background'}
                </Button>
              </div>
              {backgroundJobs.length > 0 && (
                <div className="mt-3 rounded-xl border border-[#D8E6F5] bg-[#F7FAFE] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#0B5BC1]">Background renders</p>
                    <button type="button" onClick={() => void loadBackgroundJobs()} className="text-[11px] text-[#526B89]">Refresh</button>
                  </div>
                  <div className="space-y-2">
                    {backgroundJobs.slice(0, 4).map((job) => (
                      <div key={job.id} className="rounded-lg bg-white p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-[#17365D]">{job.title}</span>
                          <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>{job.status}</Badge>
                        </div>
                        {job.status !== 'completed' && job.status !== 'failed' && <Progress value={job.progress} className="mt-2 h-1.5" />}
                        <p className="mt-1 text-[11px] text-[#7188A4]">{job.stage_message || job.stage} · {job.progress}%</p>
                        {job.status === 'completed' && job.video_url && <a className="mt-1 inline-block text-xs font-semibold text-[#0B5BC1] underline" href={job.video_url} target="_blank" rel="noreferrer">Open rendered video</a>}
                        {job.status === 'failed' && (
                          <div className="mt-1 flex items-start justify-between gap-2">
                            <p className="text-[11px] text-red-600">{job.error_message || 'Render failed'}</p>
                            <button type="button" className="shrink-0 text-[11px] font-semibold text-[#0B5BC1] underline" onClick={async () => {
                              const response = await fetch(`/api/admin/music-studio/jobs/${job.id}/retry`, { method: 'POST' });
                              const result = await response.json();
                              if (!response.ok) toast({ title: 'Retry failed', description: result.error || 'Could not retry this render', variant: 'destructive' });
                              else { toast({ title: 'Render queued again' }); void loadBackgroundJobs(); }
                            }}>Retry</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {exporting && (
                <div className="mt-3 space-y-1.5">
                  <Progress value={exportPct} className="h-2" />
                  <p className="text-xs text-[#526B89]">{exportMsg}</p>
                </div>
              )}
              {songReady && !exporting && (
                <p className="mt-2 text-[11px] text-[#7188A4]">
                  The MP4 renders faster than realtime (offline frame-by-frame). WebM records in realtime — keep this tab visible.
                </p>
              )}

              <Separator className="my-3 bg-[#D8E6F5]" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#0B5BC1]">Social Post</h3>
              <p className="mt-1 mb-2 text-[11px] text-[#7188A4]">
                Saves the script on the server, then uploads the video and the audio mix so you can preview,
                publish or delete them in the Social Engine. Deleting a video there never deletes the script or the audio.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={doSendMp4ToSocial} disabled={!songReady || exporting || publishing}
                  className="bg-[#1A73E8] text-white font-semibold hover:bg-[#2B82E8]">
                  <UploadCloud className="h-4 w-4 mr-1.5" /> Send MP4 to Social Post
                </Button>
                <Button size="sm" variant="outline" onClick={doSendWebmToSocial} disabled={!songReady || exporting || publishing}
                  className="border-[#B8D1EF] bg-white">
                  <UploadCloud className="h-4 w-4 mr-1.5" /> Send WebM
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void sendCurrentToSocial(null, 'wav')} disabled={!lyricsReady || publishing}
                  className="text-[#0B5BC1]">
                  <AudioLines className="h-4 w-4 mr-1.5" /> Script + audio only
                </Button>
              </div>
              {publishing && (
                <div className="mt-3 space-y-1.5">
                  <Progress value={exportPct} className="h-2" />
                  <p className="text-xs text-[#526B89]">{publishMsg || 'Working…'}</p>
                </div>
              )}
            </div>
          </section>

          {/* ============ RIGHT: lyrics & notes ============ */}
          <section aria-label="Lyrics and notes" className="space-y-4">
            <LyricsEditor spec={rawSpec} provider={provider} factChecked={factChecked}
              onChange={(s) => setRawSpec(s)} />
            {creativeNotes && (
              <div className="rounded-xl border border-[#D8E6F5] bg-white p-3">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#0B5BC1]">AI creative notes</p>
                <p className="text-xs text-[#405F82]">{creativeNotes}</p>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="rounded-xl border border-[#FFD60A]/30 bg-[#FFD60A]/10 p-3">
                {warnings.map((w, i) => <p key={i} className="text-[11px] text-[#0B5BC1]">{w}</p>)}
              </div>
            )}
            {timeline && (
              <div className="rounded-xl border border-[#D8E6F5] bg-white p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#526B89]">Arrangement</p>
                <div className="space-y-1.5">
                  {timeline.sections.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span className="text-[#304F73]">{s.name.toUpperCase()}</span>
                      <span className="text-[#7188A4]">{s.chords.slice(0, 4).join(' ')}</span>
                      <span className="text-[#8498AF] tabular-nums">{s.startSec.toFixed(0)}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-[#B8D1EF] bg-white">
                  <Sparkles className="h-4 w-4 mr-1.5" /> Run the 5-subject engine self-test
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-[#C8DDF5] text-[#12345B] max-w-lg">
                <DialogHeader>
                  <DialogTitle>Phase 4 — engine self-test</DialogTitle>
                  <DialogDescription className="text-[#526B89]">
                    Mitosis · Periodic table · Newton&apos;s laws · Heart circulation · Classification mnemonic
                  </DialogDescription>
                </DialogHeader>
                <SelfTestPanel />
              </DialogContent>
            </Dialog>
          </section>
        </div>
      </div>
    </main>
  );
}
