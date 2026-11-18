/**
 * Dense idle stream: subtle breathing and weight shift so characters
 * never look frozen while talking or waiting.
 */
import { CharStyle, SkeletonFrame } from '../rig/character';
import { buildFrame, idlePose } from './poses';

export function makeIdle(
  s: CharStyle,
  o: { x: number; facing: 1 | -1; startFrame: number; frames: number; fps: number },
): SkeletonFrame[] {
  const out: SkeletonFrame[] = [];
  for (let i = 0; i < o.frames; i++) {
    const t = (o.startFrame + i) / o.fps;
    const breath = Math.sin(t * 2 * Math.PI * 0.55) * 0.5 + 0.5;
    const sway = Math.sin(t * 2 * Math.PI * 0.23);
    const pose = idlePose(s, o.x + sway * 1.5, o.facing, breath);
    pose.lean = 1.5 + sway * 1.2;
    pose.armL = { mode: 'fk', sh: -9 + sway * 3, el: 7 };
    pose.armR = { mode: 'fk', sh: 9 + sway * 3, el: 7 };
    out.push(buildFrame(s, pose));
  }
  return out;
}
