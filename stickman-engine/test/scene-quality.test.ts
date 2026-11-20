import { describe, expect, it } from 'bun:test';
import { compile } from '../src/scene/compiler';
import { validateSceneScript } from '../src/scene/validate';
import { STYLES } from '../src/rig/character';
import { pushStream } from '../src/motion/actions';

const baseScript = {
  title: 'A Solo Demonstration',
  environment: { type: 'classroom', seed: 1 },
  cast: {
    ben: { style: 'ben' },
    maya: { style: 'maya' },
    prof: { style: 'prof' },
  },
  scenes: [{
    id: 's1',
    duration: 4.5,
    cast: { ben: { x: -180, facing: 1 } },
    actions: [{ char: 'ben', do: 'walk', from: -180, to: 180, speed: 150 }],
    dialogue: [{ who: 'narr', text: 'One character is enough to demonstrate the idea.' }],
  }],
};

describe('Stickman scene staging', () => {
  it('allows a solo character even when the reusable cast contains several characters', () => {
    expect(validateSceneScript(baseScript)).toEqual([]);
    const timeline = compile(baseScript as any, {});
    expect(timeline.characters.map((character) => character.id)).toEqual(['ben']);
  });

  it('accepts a scene with several characters when the story needs them', () => {
    const script = structuredClone(baseScript);
    script.scenes[0].cast = {
      ben: { x: -180, facing: 1 },
      maya: { x: 0, facing: -1 },
      prof: { x: 180, facing: -1 },
    };
    expect(validateSceneScript(script)).toEqual([]);
    const timeline = compile(script as any, {});
    expect(timeline.characters.map((character) => character.id).sort()).toEqual(['ben', 'maya', 'prof']);
  });

  it('rejects unreasonable cast sizes without imposing a two-character requirement', () => {
    const script = structuredClone(baseScript);
    for (let i = 0; i < 22; i++) script.cast[`extra${i}`] = { style: 'prof' };
    expect(validateSceneScript(script).some((problem) => problem.includes('at most 24 reusable characters'))).toBe(true);
  });
});

describe('Stickman push posture', () => {
  it('starts and finishes upright instead of holding a deep forward bend', () => {
    const result = pushStream({
      style: STYLES.ben,
      startFrame: 0,
      frames: 60,
      fps: 30,
      x: 0,
      facing: 1,
      propX: 70,
      propW: 64,
      propH: 64,
      strain: true,
    });
    const leanProxy = (frame: typeof result.frames[number]) => Math.abs(frame.neck[0] - frame.pel[0]);
    expect(leanProxy(result.frames[0])).toBeLessThan(5);
    expect(leanProxy(result.frames[30])).toBeLessThan(20);
    expect(leanProxy(result.frames[result.frames.length - 1])).toBeLessThan(5);
  });
});
