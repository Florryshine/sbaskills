/**
 * StickmanComposition: deterministic frame renderer.
 * A pure function of (frame, timeline) - no layout, no randomness at
 * render time (all randomness is seeded at compile time).
 */
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Timeline, Emotion } from '../rig/character';
import { Stickman, Prop, Environment, OverlayArrows, FormulaCard, TitleCard, Captions, Wipe } from './parts';

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

export const StickmanComposition: React.FC<{
  timeline: Timeline;
  /** Optional narration URL overrides (file -> public URL) so browser
   * previews (@remotion/player) can stream audio from Storage instead of
   * the bundler's static public dir. The CLI render omits it and uses
   * staticFile(). */
  audioUrls?: Record<string, string>;
}> = ({ timeline, audioUrls }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = timeline;
  const cam = timeline.camera[Math.min(frame, timeline.camera.length - 1)] ?? { cx: 0, cy: -160, scale: 1.8, rot: 0 };
  const [shx, shy] = shakeAt(timeline, frame);

  const sceneSpan = timeline.sceneSpans.find((s) => frame >= s.start && frame < s.end) ?? timeline.sceneSpans[0];
  const env = (timeline.environmentByScene ?? {})[sceneSpan?.id ?? ''] ?? timeline.environment;

  const caption = timeline.captions.find((c) => frame >= c.frameStart && frame <= c.frameEnd) ?? null;
  const wipe = timeline.transitions.find((t) => t.type === 'wipe' && frame >= t.frame && frame < t.frame + t.dur);
  const activeOverlays = timeline.overlays.filter((o) => frame >= o.frame && frame < o.frame + o.dur);

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
      el: <Stickman key={c.id} style={c.style} frame={kf} emotion={emotionAt(c.faceEvents, frame)} frameNo={frame} />,
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
        {caption && <Captions caption={caption} frameNo={frame} speakerColor={SPEAKER_COLORS[caption.who] ?? '#8fa4b5'} />}
        {wipe && <Wipe progress={(frame - wipe.frame) / wipe.dur} />}
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
