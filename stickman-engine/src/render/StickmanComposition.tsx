/**
 * StickmanComposition: deterministic frame renderer.
 * A pure function of (frame, timeline) - no layout, no randomness at
 * render time (all randomness is seeded at compile time).
 */
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Timeline, Emotion } from '../rig/character';
import { Stickman, Prop, Environment, OverlayArrows, FormulaCard, TitleCard, Captions, Wipe } from './parts';
import { visemeAtFrame } from './visemes';

const SPEAKER_COLORS: Record<string, string> = {
  narr: '#8fa4b5',
  ben: '#e8862e',
  maya: '#3e7fae',
};

function emotionAt(events: { frame: number; emo: Emotion }[], frame: number): Emotion {
  let cur: Emotion = 'neutral';
  for (const e of events) {
    if (e.frame <= frame) cur = e.emo;
    else break;
  }
  return cur;
}

function shakeAt(timeline: Timeline, frame: number): [number, number] {
  let dx = 0, dy = 0;
  for (const s of timeline.shakeEvents) {
    const dur = Math.max(1, Math.round(s.dur * timeline.fps));
    const t = frame - s.frame;
    if (t >= 0 && t <= dur) {
      const k = 1 - t / dur;
      dx += s.amp * k * Math.sin(t * 1.9 + 1.3);
      dy += s.amp * 0.6 * k * Math.cos(t * 1.4);
    }
  }
  return [dx, dy];
}

type ImagePresenterRenderData = { imageEvents?: Array<{ frameStart: number; frameEnd: number; mediaUrl: string; region: { x: number; y: number; width: number; height: number }; label?: string; attribution?: string; order?: number }>; annotationEvents?: Array<{ frameStart: number; frameEnd: number; label: string; region: { x: number; y: number; width: number; height: number } }> };\n\nexport const StickmanComposition: React.FC<{\n  imagePresenter?: ImagePresenterRenderData;
  timeline: Timeline;
  /** Optional narration URL overrides (file -> public URL) so browser
   * previews (@remotion/player) can stream audio from Storage instead of
   * the bundler's static public dir. The CLI render omits it and uses
   * staticFile(). */
  audioUrls?: Record<string, string>;
}> = ({ timeline, audioUrls, imagePresenter }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = timeline;
  const cam = timeline.camera[Math.min(frame, timeline.camera.length - 1)] ?? { cx: 0, cy: -160, scale: 1.8, rot: 0 };
  const [shx, shy] = shakeAt(timeline, frame);

  const sceneSpan = timeline.sceneSpans.find((s) => frame >= s.start && frame < s.end) ?? timeline.sceneSpans[0];
  const env = (timeline.environmentByScene ?? {})[sceneSpan?.id ?? ''] ?? timeline.environment;

  const caption = timeline.captions.find((c) => frame >= c.frameStart && frame <= c.frameEnd) ?? null;

  // Active viseme: if the current caption's speaker is on stage and we're
  // inside their dialogue, compute the mouth shape for this frame.
  const activeVisemeFor = (charId: string): ReturnType<typeof visemeAtFrame> | undefined => {
    if (!caption || caption.who !== charId) return undefined;
    return visemeAtFrame(caption.words, frame);
  };
  const wipe = timeline.transitions.find((t) => t.type === 'wipe' && frame >= t.frame && frame < t.frame + t.dur);
  const activeOverlays = timeline.overlays.filter((o) => frame >= o.frame && frame < o.frame + o.dur);\n  const activeImages = (imagePresenter?.imageEvents ?? []).filter((event) => frame >= event.frameStart && frame < event.frameEnd).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));\n  const activeAnnotations = (imagePresenter?.annotationEvents ?? []).filter((event) => frame >= event.frameStart && frame < event.frameEnd);

  // layer everything by z
  const drawables: { z: number; el: React.ReactElement }[] = [];
  for (const p of timeline.props) {
    const kf = p.frames[Math.min(frame, p.frames.length - 1)];
    if (kf && Math.abs(kf.x - (sceneSpan ? 0 : 0)) < 1e9) {
      drawables.push({ z: p.z, el: <Prop key={p.id} prop={p} frameNo={frame} /> });
    }
  }
  for (const c of timeline.characters) {
    const kf = c.frames[Math.min(frame, c.frames.length - 1)];
    if (!kf) continue;
    if (kf.pel[0] < -2000) continue;   // parked offscreen
    drawables.push({
      z: c.z + 2,
      el: <Stickman key={c.id} style={c.style} frame={kf} emotion={emotionAt(c.faceEvents, frame)} frameNo={frame} mouth={activeVisemeFor(c.id)} />,
    });
  }
  drawables.sort((a, b) => a.z - b.z);

  const camTransform = `translate(${W / 2 + shx} ${H / 2 + shy}) scale(${cam.scale}) rotate(${cam.rot}) translate(${-cam.cx} ${-cam.cy})`;

  return (
    <AbsoluteFill style={{ backgroundColor: '#f2f6f8', fontFamily: "'DejaVu Sans', sans-serif" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <g transform={camTransform}>
          <Environment env={env} cx={cam.cx} frameNo={frame} />
          {drawables.map((d) => d.el)}
          {activeOverlays.map((o, i) => {
            if (o.type === 'arrows') {
              return <OverlayArrows key={`ov${i}`} arrows={o.arrows} appear={frame - o.frame} />;
            }
            return null;
          })}
        </g>
        {/* screen-space educational overlays stay fixed during camera moves */}
        {activeOverlays.map((o, i) => {
          if (o.type === 'formula') return <FormulaCard key={`f${i}`} text={o.text} appear={frame - o.frame} />;
          if (o.type === 'title') return <TitleCard key={`t${i}`} text={o.text} sub={o.sub} appear={frame - o.frame} />;
          return null;
        })}
        {activeImages.map((event, index) => {
          const x = event.region.x * W, y = event.region.y * H;
          const width = event.region.width * W, height = event.region.height * H;
          return <g key={'presenter-image-' + index}>
            <rect x={x - 3} y={y - 3} width={width + 6} height={height + 6} rx={16} fill="#ffffff" stroke="#d5dee7" strokeWidth={3} />
            <image href={event.mediaUrl} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid meet" />
            {event.label && <text x={x + 12} y={y + 24} fill="#102a43" fontSize={18} fontWeight={700}>{event.label.slice(0, 48)}</text>}
          </g>;
        })}
        {activeAnnotations.map((event, index) => {
          const x = event.region.x * W, y = event.region.y * H;
          const width = event.region.width * W, height = event.region.height * H;
          return <g key={'presenter-annotation-' + index}>
            <rect x={x} y={y} width={width} height={height} fill="#facc15" fillOpacity={0.10} stroke="#dc2626" strokeWidth={4} strokeDasharray="10 6" rx={8} />
            <text x={x + 8} y={y + 22} fill="#991b1b" fontSize={16} fontWeight={700}>{event.label.slice(0, 42)}</text>
          </g>;
        })}
        {caption && <Captions caption={caption} frameNo={frame} speakerColor={SPEAKER_COLORS[caption.who] ?? '#8fa4b5'} />}
        {activeImages.some(event => event.attribution) && <text x={W - 18} y={H - 18} textAnchor="end" fill="#475569" fontSize={12}>Image credits: {[...new Set(activeImages.map(event => event.attribution).filter(Boolean))].join(', ').slice(0, 100)}</text>}\n        {wipe && <Wipe progress={(frame - wipe.frame) / wipe.dur} />}
      </svg>
      {/* Each clip starts at the frame the compiler assigned to its dialogue
          line. Without the Sequence wrapper every clip plays from frame 0 and
          all voices talk over each other (the original audio-timing bug). */}
      {timeline.audio.map((a, i) => (
        <Sequence key={`a${i}`} from={Math.max(0, Math.round(a.frameStart))}>
          <Audio src={audioUrl(a.file, audioUrls)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** staticFile inside the bundler; direct URL override when previewing. */
function audioUrl(file: string, audioUrls?: Record<string, string>): string {
  if (audioUrls && audioUrls[file]) return audioUrls[file];
  return staticFile(file);
}

export default StickmanComposition;
