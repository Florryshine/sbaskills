// remotion/index.js
// Entry point for @remotion/bundler's bundle({ entryPoint: ... }) call in
// local-video-renderer/worker.js.
import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
