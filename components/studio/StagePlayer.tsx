'use client';

/**
 * StagePlayer — live kinetic typography preview with transport controls.
 * The canvas draws frames from the shared timeline using the audio element's
 * clock, which is exactly what the exporter renders offline.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { Timeline } from '@/lib/studio/types';
import type { TypographyStyle } from '@/lib/studio/typography';
import { drawFrame } from '@/lib/studio/typography';

interface Props {
  timeline: Timeline | null;
  audioUrl: string | null;
  style: TypographyStyle;
  aspect: '9:16' | '1:1' | '16:9';
  playing: boolean;
  onPlayingChange: (p: boolean) => void;
  busy?: boolean;
}

const ASPECT_CLASS: Record<string, string> = {
  '9:16': 'aspect-[9/16] max-w-[340px] sm:max-w-[400px]',
  '1:1': 'aspect-square max-w-[460px]',
  '16:9': 'aspect-video max-w-[640px]',
};

export default function StagePlayer({ timeline, audioUrl, style, aspect, playing, onPlayingChange, busy }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const styleRef = useRef(style);
  const timelineRef = useRef<Timeline | null>(timeline);
  const [position, setPosition] = useState(0);

  // keep the draw-loop's sources current without re-subscribing the rAF loop
  useEffect(() => {
    styleRef.current = style;
  }, [style]);
  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  // draw loop (also covers the idle "attract" frame when no audio exists)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const loop = () => {
      const tl = timelineRef.current;
      const a = audioRef.current;
      let t = 0;
      let live = false;
      if (tl && a && a.readyState >= 2) {
        t = a.currentTime;
        live = true;
      }
      if (live) setPosition(t);

      if (tl) {
        drawFrame(ctx, canvas.width, canvas.height, Math.min(t, tl.durationSec), tl, styleRef.current);
      } else {
        // attract screen
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, '#2A1A5E');
        g.addColorStop(1, '#120A2E');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `900 ${Math.round(canvas.height * 0.05)}px 'Arial Black',Impact,'DejaVu Sans',sans-serif`;
        ctx.fillStyle = '#FFD60A';
        ctx.textAlign = 'center';
        ctx.fillText('SBA MUSICAL', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText('LEARNING STUDIO', canvas.width / 2, canvas.height / 2 + canvas.height * 0.05);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { void a.play(); onPlayingChange(true); }
    else { a.pause(); onPlayingChange(false); }
  };

  const seek = (v: number[]) => {
    const a = audioRef.current;
    if (!a || !timeline) return;
    a.currentTime = (v[0] / 100) * timeline.durationSec;
    setPosition(a.currentTime);
  };

  const progress = timeline ? Math.min(100, (position / timeline.durationSec) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className={`relative w-full ${ASPECT_CLASS[aspect]} rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#120A2E]`}>
        <canvas
          ref={canvasRef}
          width={aspect === '16:9' ? 1280 : aspect === '1:1' ? 1080 : 720}
          height={aspect === '16:9' ? 720 : aspect === '1:1' ? 1080 : 1280}
          className="w-full h-full"
        />
        {busy && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/30 border-t-[#FFD60A]" />
          </div>
        )}
      </div>

      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onEnded={() => onPlayingChange(false)}
        className="hidden"
      />

      <div className="flex items-center gap-3 w-full max-w-xl">
        <Button size="icon" variant="secondary" disabled={!audioUrl} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" disabled={!audioUrl} aria-label="Restart"
          onClick={() => { const a = audioRef.current; if (a) { a.currentTime = 0; setPosition(0); } }}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Slider value={[progress]} max={100} step={0.5} onValueChange={seek} disabled={!audioUrl} className="flex-1" />
        <span className="text-xs text-white/70 tabular-nums w-16 text-right">
          {fmt(position)} / {timeline ? fmt(timeline.durationSec) : '0:00'}
        </span>
      </div>
    </div>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
