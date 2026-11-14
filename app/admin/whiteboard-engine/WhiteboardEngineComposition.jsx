'use client';

import { Player } from '@remotion/player';
import { WhiteboardVideo } from '../../../whiteboard-engine/src/remotion/WhiteboardVideo';

/**
 * Preview bridge: renders the engine's composition inside @remotion/player
 * with the job's timeline + public narration URLs from Supabase storage.
 */
export function WhiteboardEngineComposition({ job }) {
  const timeline = job.timeline;
  const audioUrls = {};
  for (const audio of job.audio_files || []) {
    if (audio.publicUrl) audioUrls[audio.audioFile] = audio.publicUrl;
  }
  return (
    <Player
      component={WhiteboardVideo}
      inputProps={{ timeline, audioUrls }}
      durationInFrames={Math.max(1, Math.ceil((timeline.totalDuration || 10) * 30))}
      fps={30}
      compositionWidth={1920}
      compositionHeight={1080}
      style={{ width: '100%', height: '100%' }}
      controls
      autoPlay
      loop
    />
  );
}
