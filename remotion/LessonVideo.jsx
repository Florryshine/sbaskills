// remotion/LessonVideo.jsx
//
// Renders one Sequence per script segment: background (stock video, falling
// back to stock image, falling back to a plain brand gradient), a synced
// audio track, and the segment's narration line as an on-screen caption.
// inputProps shape (set by local-video-renderer/worker.js):
//   { title, orientation: 'vertical'|'horizontal', segments: [
//       { text, visual_cue, durationSeconds, audioSrc, imageSrc, videoSrc }
//   ]}
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  Audio,
  Img,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';

const BRAND = {
  navy: '#0a1f44',
  gold: '#FFCC00',
  blue: '#1a73e8',
};

function Segment({ segment, durationInFrames }) {
  const frame = useCurrentFrame();

  // Slow Ken Burns zoom over the full segment — makes static stock photos
  // feel less like a slideshow.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateRight: 'clamp',
    easing: Easing.linear,
  });

  // Quick fade in/out at each segment's edges so cuts aren't jarring.
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        {segment.videoSrc ? (
          <Video
            src={segment.videoSrc}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : segment.imageSrc ? (
          <Img src={segment.imageSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <AbsoluteFill
            style={{ background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.blue})` }}
          />
        )}
      </AbsoluteFill>

      {/* Darken the bottom third so caption text stays legible over any background */}
      <AbsoluteFill
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 42%)' }}
      />

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 110,
          paddingLeft: 60,
          paddingRight: 60,
          opacity,
        }}
      >
        <div
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontWeight: 800,
            fontSize: 54,
            lineHeight: 1.25,
            color: 'white',
            textAlign: 'center',
            textShadow: '0 4px 20px rgba(0,0,0,0.65)',
          }}
        >
          {segment.text}
        </div>
      </AbsoluteFill>

      {segment.audioSrc && <Audio src={segment.audioSrc} />}
    </AbsoluteFill>
  );
}

export function LessonVideo({ segments = [] }) {
  const { fps } = useVideoConfig();
  let cursor = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {segments.map((segment, i) => {
        const durationInFrames = Math.max(1, Math.round((segment.durationSeconds || 3) * fps));
        const from = cursor;
        cursor += durationInFrames;
        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames}>
            <Segment segment={segment} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}

      {/* Persistent brand watermark over the whole video */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 40,
            background: BRAND.blue,
            color: 'white',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontWeight: 700,
            fontSize: 26,
            padding: '10px 22px',
            borderRadius: 10,
          }}
        >
          Shiney Brain Academy
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
