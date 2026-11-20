// src/render/VLVideo.tsx — the top-level Visual Learning composition.
//
// Receives the deterministic timeline + episode script + per-scene shot maps
// and renders: paper background → scene Sequences (crossfaded) → narration
// Audio per scene → music bed with the ducking envelope → caption bar →
// progress bar → watermark. Works identically in the CLI render and the
// @remotion/player studio preview (assets resolve via staticFile or absolute
// preview URLs).

import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { EpisodeScript, SceneSpec, VLTimeline } from '../types';
import { musicVolumeAtFrame } from '../timeline/builder';
import { layoutFor, THEME } from './theme';
import { registerVLFonts } from './fonts';
import { CaptionBar, PaperBackground, ProgressBar, SceneFade, Watermark, assetSrc } from './ui';
import { itemRevealDelays, sceneComponent } from './scenes';

export interface VLVideoProps {
  script: EpisodeScript;
  timeline: VLTimeline;
  /** sceneIndex -> asset paths/URLs (main shots + optional compare right) */
  images: Record<number, { main?: string; right?: string; shots?: string[] }>;
  /** when set, asset files resolve against this base URL instead of staticFile (studio preview) */
  assetBaseUrl?: string;
  /** studio preview may omit audio entirely */
  muted?: boolean;
  accent?: string;
}

/** Extract the per-item text arrays the reveal timing needs, per scene type. */
function itemTexts(spec: SceneSpec): { text: string }[] {
  switch (spec.type) {
    case 'list':
      return spec.items;
    case 'process':
      return spec.steps;
    case 'recap':
      return spec.items.map((t) => ({ text: t }));
    default:
      return [];
  }
}

export const VLVideo: React.FC<VLVideoProps> = ({ script, timeline, images, assetBaseUrl, muted, accent }) => {
  registerVLFonts();
  const accentColor = accent || timeline.meta.accent || THEME.accent;
  const layout = useMemo(
    () => layoutFor(timeline.width > timeline.height ? '16:9' : timeline.width === timeline.height ? '1:1' : '9:16'),
    [timeline.width, timeline.height],
  );
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: THEME.paper }}>
      <PaperBackground layout={layout} />

      {timeline.scenes.map((scene, i) => {
        const spec = script.scenes[i];
        if (!spec) return null;
        const Component = sceneComponent(scene.type);
        const itemDelays = itemRevealDelays(scene, itemTexts(spec));
        const img = images[scene.sceneIndex] ?? {};
        const shotSrcs = ((img.shots?.length ? img.shots : scene.shots) || [])
          .map((f) => assetSrc(f, assetBaseUrl))
          .filter((s): s is string => Boolean(s));
        const mainSrc = img.main ? assetSrc(img.main, assetBaseUrl) : shotSrcs[0] ?? null;
        const imageSrcB = img.right ? assetSrc(img.right, assetBaseUrl) : null;
        const narrationStart = scene.narrationDelayFrames;
        const narrationFrames = Math.ceil(scene.narrationDuration * fps) + 30;
        return (
          <Sequence key={`scene-${scene.sceneIndex}`} from={scene.startFrame} durationInFrames={scene.durationFrames} name={`scene-${i}-${scene.type}`}>
            <SceneFade isFirst={i === 0} isLast={i === timeline.scenes.length - 1} sceneFrames={scene.durationFrames}>
              <Component
                spec={spec}
                scene={scene}
                layout={layout}
                imageSrcs={shotSrcs.length > 0 ? shotSrcs : mainSrc ? [mainSrc] : []}
                imageSrcB={imageSrcB}
                accent={accentColor}
                itemDelays={itemDelays}
              />
            </SceneFade>
            {!muted && scene.narrationFile && !scene.narrationFile.endsWith('.json') ? (
              <Sequence from={narrationStart} durationInFrames={narrationFrames}>
                <Audio src={assetSrc(scene.narrationFile, assetBaseUrl) ?? undefined} />
              </Sequence>
            ) : null}
          </Sequence>
        );
      })}

      {/* Music bed with ducking envelope */}
      {!muted && timeline.musicFile ? (
        <Audio src={assetSrc(timeline.musicFile, assetBaseUrl) ?? undefined} volume={(f) => musicVolumeAtFrame(timeline, f, 0.5)} />
      ) : null}

      {/* Word-synced captions */}
      {timeline.subtitles
        ? timeline.scenes.map((scene, i) => {
            if (!scene.words || scene.words.length === 0) return null;
            return (
              <Sequence key={`cap-${scene.sceneIndex}`} from={scene.startFrame} durationInFrames={scene.durationFrames}>
                <CaptionBar text={scene.caption} words={scene.words} layout={layout} narrationDelayFrames={scene.narrationDelayFrames} accentColor={accentColor} />
              </Sequence>
            );
          })
        : null}

      <ProgressBar progress={frame / Math.max(1, timeline.totalFrames)} layout={layout} color={accentColor} />
      {timeline.watermark ? <Watermark text={timeline.watermark} layout={layout} /> : null}
    </AbsoluteFill>
  );
};
