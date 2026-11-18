/**
 * Auto camera director — pick shots from scene content when the script
 * didn't specify camera intents explicitly.
 *
 * Rules:
 *   - 0 speakers, no actions -> establish (wide)
 *   - 1 speaker -> establish, then follow that speaker
 *   - 2 speakers -> establish, then a two-shot on both
 *   - 3+ speakers or heavy action -> establish, then cut to whoever is
 *     talking at each line's start frame
 */
import { Scene, SceneAction, CameraIntent } from '../rig/character';

type Cast = Record<string, { x: number }>;

export function autoDirector(
  scene: Scene,
  cast: Cast,
  actions: SceneAction[],
): CameraIntent[] {
  // Explicit camera overrides everything.
  if (scene.camera && scene.camera.length > 0) return [];

  const dialogue = scene.dialogue ?? [];
  const speakers = Array.from(new Set(
    dialogue.map((d) => d.who).filter((w): w is string => !!w && w !== 'narr'),
  ));

  const hasMotion = actions.some((a) =>
    ['walk', 'run', 'jump', 'dance', 'fall', 'getUp', 'throw', 'pull'].includes(a.do as string),
  );
  const hasInteract = actions.some((a) =>
    ['approach', 'retreat', 'recoil', 'leanIn', 'faceToward'].includes(a.do as string),
  );

  // Nothing happening -> wide shot.
  if (speakers.length === 0 && !hasMotion && !hasInteract) {
    return [{ do: 'establish' }];
  }

  // One speaker -> wide, then follow them.
  if (speakers.length === 1) {
    const target = speakers[0];
    return [
      { do: 'establish', dur: 0.7 },
      { do: 'follow', target, at: 0.7 },
    ];
  }

  // Two speakers -> wide, then two-shot.
  if (speakers.length === 2) {
    const [a, b] = speakers;
    return [
      { do: 'establish', dur: 0.6 },
      { do: 'twoShot', targets: [a, b], at: 0.6 },
    ];
  }

  // 3+ speakers or unresolved -> wide shot only (safest).
  return [{ do: 'establish' }];
}
