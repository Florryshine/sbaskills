'use client';

import { Player } from '@remotion/player';
import { StickmanComposition } from '../../../stickman-engine/src/render/StickmanComposition';

/**
 * Preview bridge: renders the engine's composition inside @remotion/player
 * with the job's compiled timeline + public narration URLs from Supabase
 * storage (the bundler's static public dir only exists during CLI renders).
 */
export function StickmanEngineComposition({ job }) {
  const timeline = job.timeline;
  const audioUrls = {};
  for (const entry of job.audio_files || []) {
    if (entry && typeof entry === 'object' && entry.file && entry.publicUrl) {
      audioUrls[entry.file] = entry.publicUrl;
    }
  }
  return (
    <Player
      component={StickmanComposition}
      inputProps={{ timeline, audioUrls }}
      durationInFrames={Math.max(1, timeline.durationFrames || 1)}
      fps={timeline.fps || 30}
      compositionWidth={timeline.width || 720}
      compositionHeight={timeline.height || 1280}
      style={{ width: '100%', height: '100%' }}
      controls
      autoPlay
      loop
    />
  );
}
