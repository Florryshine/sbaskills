// src/remotion/WhiteboardVideo.tsx — main composition: board, camera, scenes, audio.

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/fonts';
import type { Timeline } from '../types';
import { SceneRenderer } from './SceneRenderer';

// Local OFL-licensed handwriting fonts, loaded with proper delayRender
// semantics so no frame is captured before the typefaces are ready.
loadFont({
  family: 'Caveat',
  url: staticFile('fonts/Caveat-Bold.ttf'),
  weight: '700',
  format: 'truetype',
});
loadFont({
  family: 'Patrick Hand',
  url: staticFile('fonts/PatrickHand-Regular.ttf'),
  weight: '400',
  format: 'truetype',
});
loadFont({
  family: 'Kalam',
  url: staticFile('fonts/Kalam-Regular.ttf'),
  weight: '400',
  format: 'truetype',
});

export const WhiteboardVideo: React.FC<{
  timeline: Timeline;
  /** Optional absolute audio URL overrides (used by the admin Player preview). */
  audioUrls?: Record<string, string>;
}> = ({ timeline, audioUrls }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: timeline.theme.board }}>
      {timeline.scenes.map((scene, i) => {
        const fromFrame = Math.round(scene.start * fps);
        const durationFrames = Math.ceil(scene.duration * fps);
        const audioFrom = Math.round(scene.leadIn * fps);
        const cam = scene.camera;
        const localFrame = frame - fromFrame;
        const zoom = interpolate(localFrame, [0, durationFrames], [cam.zoomStart, cam.zoomEnd], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const drift = interpolate(localFrame, [0, durationFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const flash =
          i > 0
            ? interpolate(localFrame, [0, 6], [0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            : interpolate(localFrame, [0, 10], [0.5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        return (
          <Sequence key={scene.id} from={fromFrame} durationInFrames={durationFrames} name={`Scene ${i + 1} (${scene.layout})`}>
            <AbsoluteFill>
              <AbsoluteFill
                style={{
                  transform: `scale(${zoom}) translate(${cam.panX * (1 - drift)}px, ${cam.panY * (1 - drift)}px)`,
                  transformOrigin: 'center center',
                }}
              >
                {/* vignette */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(40,40,40,0.10) 100%)`,
                    pointerEvents: 'none',
                  }}
                />
                <SceneRenderer scene={scene} timeline={timeline} />
                {/* brand watermark */}
                <div
                  style={{
                    position: 'absolute',
                    right: 42,
                    bottom: 26,
                    fontFamily: "'Kalam', cursive",
                    fontSize: 26,
                    color: timeline.theme.inkSoft,
                    opacity: 0.55,
                  }}
                >
                  Shiney Brain Academy
                </div>
              </AbsoluteFill>
              {/* chalk-dust flash between scenes */}
              {flash > 0.01 && (
                <AbsoluteFill style={{ backgroundColor: '#FFFFFF', opacity: flash, pointerEvents: 'none' }} />
              )}
            </AbsoluteFill>
            <Sequence from={audioFrom}>
              <Audio
                src={audioUrls?.[scene.audioFile] ?? staticFile(scene.audioFile)}
                volume={(f) =>
                  interpolate(f, [0, 2, Math.max(3, durationFrames - audioFrom - 2)], [0, 1, 1], {
                    extrapolateRight: 'clamp',
                  })
                }
              />
            </Sequence>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default WhiteboardVideo;
