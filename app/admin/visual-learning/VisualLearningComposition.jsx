'use client';

import { Player } from '@remotion/player';
import { useMemo } from 'react';
import { VLVideo } from '../../../visual-learning-engine/src/render/VLVideo';

/**
 * Preview bridge: renders the engine's composition inside @remotion/player
 * with the job's script/timeline and public asset URLs from Supabase storage
 * (worker saves timeline.previewBaseUrl pointing at the job's assets folder).
 */
export function VisualLearningComposition({ job }) {
  const inputProps = useMemo(() => {
    const timeline = job?.timeline;
    const script = job?.script;
    if (!timeline || !script) return null;
    const assetBaseUrl = timeline.previewBaseUrl || '';
    // sceneIndex -> { main, right, shots } from the saved image manifest
    const images = {};
    for (const asset of job?.image_manifest?.assets || []) {
      const entry = images[asset.sceneIndex] || (images[asset.sceneIndex] = { shots: [] });
      if (/-b\.jpg$/.test(asset.file)) entry.right = asset.file;
      else if (/-a\.jpg$/.test(asset.file)) entry.main = asset.file;
      else if (/-s(\d+)\.jpg$/.test(asset.file)) {
        const idx = Number(asset.file.match(/-s(\d+)\.jpg$/)[1]);
        entry.shots[idx] = asset.file;
        if (!entry.main) entry.main = asset.file;
      } else if (!entry.main) entry.main = asset.file;
    }
    for (const entry of Object.values(images)) {
      entry.shots = (entry.shots || []).filter(Boolean);
    }
    return { script, timeline, images, assetBaseUrl: assetBaseUrl || undefined };
  }, [job]);

  if (!inputProps) return null;
  const { timeline } = inputProps;
  return (
    <Player
      component={VLVideo}
      inputProps={inputProps}
      durationInFrames={Math.max(2, timeline.totalFrames)}
      fps={timeline.fps || 30}
      compositionWidth={timeline.width}
      compositionHeight={timeline.height}
      style={{ width: '100%', height: '100%', background: '#FDFBF7' }}
      controls
      autoPlay
      loop
    />
  );
}
