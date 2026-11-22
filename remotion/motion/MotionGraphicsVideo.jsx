// MotionGraphicsVideo — the Dynamic Motion Graphics Engine composition.
//
// inputProps:
// {
//   spec:        creative direction + scene plan + music plan (from lib/motion)
//   audio: {
//     musicUrl:      background music (URL or staticFile path)
//     musicVolume:   0..1
//     narration:     { [sceneId]: { url, durationSeconds, words: [{word,start,end}] } }
//     sfx:           { [sceneId]: [{ type, url, at, strength }] }   (at = seconds into scene)
//     narrationVolume
//   }
//   orientation: '9:16' | '16:9' | '1:1'
//   subtitles:   boolean
//   brandLine:   string
// }
//
// Scenes are laid out end-to-end; each boundary transitions with the scene's
// planned transition (overlapping sequences), the music bed runs underneath
// and narration audio starts exactly at its scene boundary.

import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig, staticFile, interpolate } from 'remotion';
import { registerMotionFonts, themeOf, DIMENSIONS } from './theme.js';
import { MotionBackground, GrainOverlay } from './Background.jsx';
import { CameraMove } from './camera.js';
import { SceneLayout } from './layouts.jsx';
import { SubtitleTrack, BrandTag, ProgressBar } from './Subtitles.jsx';
import { enterStyle, exitStyle, TransitionOverlay, transitionOverlap } from './transitions.js';

registerMotionFonts();

// Audio sources may be remote URLs (production worker) or `static:` paths
// resolved through the bundle's public dir (local renders + previews).
function resolveAudioSrc(src) {
  if (typeof src === 'string' && src.startsWith('static:')) {
    return staticFile(src.slice('static:'.length));
  }
  return src;
}

export function totalDurationSeconds(spec) {
  const scenes = spec?.scenes || [];
  return scenes.reduce((a, s) => a + (s.durationSeconds || 3), 0) + 0.5;
}

const SceneWithCamera = ({ scene, direction, overlapFrames, totalFrames }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = useMemo(() => themeOf(direction), [direction]);
  // local progress used by exit transforms in the overlap window
  const remain = durationInFrames - frame;
  const exiting = frame > durationInFrames - overlapFrames;
  const exitP = exiting ? 1 - remain / overlapFrames : 0;
  const enterP = Math.min(1, frame / Math.max(1, overlapFrames));
  const style = exiting
    ? exitStyle(scene.transition?.type || 'push', exitP, scene.transition?.direction || 'left')
    : enterStyle(scene.transition?.type || 'push', enterP, scene.transition?.direction || 'left', theme.palette.accent);

  return (
    <AbsoluteFill style={style}>
      <CameraMove camera={scene.camera}>
        <MotionBackground direction={direction} theme={theme} />
        <SceneLayout scene={scene} direction={direction} />
      </CameraMove>
    </AbsoluteFill>
  );
};

export const MotionGraphicsVideo = ({
  spec,
  audio = {},
  orientation = '9:16',
  subtitles = true,
  brandLine = 'Shiney Brain Academy',
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const direction = spec?.direction || {};
  const scenes = spec?.scenes || [];
  const theme = useMemo(() => themeOf(direction), [direction]);
  const narrationMap = audio.narration || {};
  const sfxMap = audio.sfx || {};

  // Scene boundaries in seconds/frames
  const boundaries = useMemo(() => {
    let acc = 0;
    return scenes.map((s) => {
      const start = acc;
      acc += s.durationSeconds || 3;
      return { start, end: acc, scene: s };
    });
  }, [scenes]);

  if (!scenes.length) {
    return (
      <AbsoluteFill style={{ background: direction.palette?.bg || '#0b0f1a' }}>
        <div style={{ color: direction.palette?.ink || '#fff', fontSize: 40, textAlign: 'center', paddingTop: '45vh' }}>
          Motion Graphics: no scenes yet
        </div>
      </AbsoluteFill>
    );
  }

  const narrationWindows = boundaries.map((b) => ({ start: b.start, end: b.start + (b.scene.durationSeconds || 3) * 0.94 }));

  // One global subtitle track (absolute times) — avoids double subtitles
  // during transition overlaps and keeps highlighting smooth across cuts.
  const globalWords = subtitles
    ? boundaries.flatMap((b) => (narrationMap[b.scene.id]?.words || []).map((w) => ({ ...w, start: w.start + b.start, end: w.end + b.start })))
    : [];

  return (
    <AbsoluteFill style={{ background: direction.palette?.bg || '#0b0f1a' }}>
      {boundaries.map((b, i) => {
        const overlapSec = i === 0 ? 0 : transitionOverlap(b.scene.transition?.type, direction.cutSpeed);
        const overlapFrames = Math.round(overlapSec * fps);
        const isLast = i === boundaries.length - 1;
        const startFrame = Math.max(0, Math.round(b.start * fps) - overlapFrames);
        // The scene starts `overlapFrames` early to overlap the previous one,
        // so it runs its natural duration + the overlap (+ a short tail on
        // the final scene so the outro breathes).
        const durationFrames = Math.round((b.scene.durationSeconds || 3) * fps)
          + overlapFrames
          + (isLast ? Math.round(0.5 * fps) : 0);
        const narration = narrationMap[b.scene.id];
        const sfxList = sfxMap[b.scene.id] || [];
        return (
          <Sequence
            key={b.scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={`${b.scene.layout}·${b.scene.id}`}
          >
            <SceneWithCamera
              scene={b.scene}
              direction={direction}
              overlapFrames={overlapFrames}
              totalFrames={durationFrames}
            />
            {/* Audio + subtitles are timed relative to the scene boundary,
                so they live in a nested sequence offset by the overlap. */}
            <Sequence from={overlapFrames} durationInFrames={durationFrames - overlapFrames} layout="none">
              {narration?.url ? <Audio src={resolveAudioSrc(narration.url)} volume={(audio.narrationVolume ?? 1)} /> : null}
              {sfxList.map((s, si) => (
                <Sequence key={si} from={Math.max(0, Math.round((s.at || 0) * fps))} durationInFrames={Math.max(1, Math.round((s.durationSeconds || 0.6) * fps))}>
                  <Audio src={resolveAudioSrc(s.url)} volume={Math.max(0.08, Math.min(1, s.strength ?? 0.7))} />
                </Sequence>
              ))}
            </Sequence>
          </Sequence>
        );
      })}

      {/* Transition overlays at each boundary */}
      {boundaries.map((b, i) => {
        if (i === 0) return null;
        const overlapSec = transitionOverlap(b.scene.transition?.type, direction.cutSpeed);
        const overlapFrames = Math.round(overlapSec * fps);
        const startFrame = Math.max(0, Math.round(b.start * fps) - overlapFrames);
        return (
          <Sequence key={`ov-${b.scene.id}`} from={startFrame} durationInFrames={overlapFrames} name={`cut-${i}`} layout="none">
            <OverlayFrame scene={b.scene} theme={theme} overlapFrames={overlapFrames} />
          </Sequence>
        );
      })}

      {/* global subtitle track + music bed + chrome */}
      {globalWords.length ? (
        <SubtitleTrack
          words={globalWords}
          color={theme.palette.ink}
          accent={theme.palette.accent}
          activeColor={theme.palette.accent}
          fontFamily={theme.type.bodyFamily}
          fontSize={38}
        />
      ) : null}
      {audio.musicUrl ? <Audio src={resolveAudioSrc(audio.musicUrl)} volume={audio.musicVolume ?? 0.9} /> : null}

      <ProgressBar color={theme.palette.accent} progress={frame / (totalDurationSeconds(spec) * fps)} />
      <BrandTag text={brandLine} color={theme.palette.ink} accent={theme.palette.accent} fontFamily={theme.type.bodyFamily} />
      <GrainOverlay opacity={theme.light.grain || 0.08} />
    </AbsoluteFill>
  );
};

const OverlayFrame = ({ scene, theme, overlapFrames }) => {
  const frame = useCurrentFrame();
  const p = Math.max(0, Math.min(1, frame / Math.max(1, overlapFrames)));
  return <TransitionOverlay type={scene.transition?.type || 'push'} p={p} accent={theme.palette.accent} direction={scene.transition?.direction || 'left'} />;
};

export default MotionGraphicsVideo;
