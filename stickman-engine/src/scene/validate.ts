/**
 * Structural validation of a SceneScript. Shared by:
 *   - app/api/admin/stickman-engine (paste-script path + AI job creation)
 *   - local-video-renderer/stickman-worker.js (AI reflect loop: rejected
 *     scripts are fed back into the planner prompt with these messages)
 *
 * Pure function: returns a list of human-readable problems (empty = valid).
 */
import { STYLES } from '../rig/character';

const KNOWN_ENVIRONMENTS = new Set(['street', 'abstract', 'classroom']);
const KNOWN_ACTIONS = new Set([
  'walk', 'run', 'push', 'point', 'present', 'wave', 'reactSurprise',
  'cheer', 'laugh', 'stumble', 'sit', 'face', 'talkGestures',
]);

const MAX_SCENES = 12;
const MAX_DURATION_SECONDS = 8 * 60;

export function validateSceneScript(script: any): string[] {
  const problems: string[] = [];
  if (!script || typeof script !== 'object' || Array.isArray(script)) {
    return ['script must be a JSON object'];
  }
  if (!script.title || typeof script.title !== 'string') problems.push('title is required');
  else if (script.title.length > 200) problems.push('title must be at most 200 characters');

  if (!Array.isArray(script.scenes) || script.scenes.length === 0) problems.push('scenes[] is required');
  if (!script.cast || typeof script.cast !== 'object' || Array.isArray(script.cast) || Object.keys(script.cast).length === 0) {
    problems.push('cast{} is required (at least one character, e.g. {"ben": {"style": "ben"}})');
  } else {
    for (const [id, c] of Object.entries<any>(script.cast)) {
      if (!c || typeof c !== 'object' || typeof c.style !== 'string') {
        problems.push(`cast.${id}: { "style": "ben" | "maya" | "prof" } is required`);
      } else if (!STYLES[c.style]) {
        problems.push(`cast.${id}: unknown style "${c.style}" (choose one of: ${Object.keys(STYLES).join(', ')})`);
      }
    }
  }

  const env = script.environment;
  if (!env || typeof env !== 'object' || !KNOWN_ENVIRONMENTS.has(env.type)) {
    problems.push(`environment must be one of: ${[...KNOWN_ENVIRONMENTS].map((t) => `{"type": "${t}", ...}`).join(', ')}`);
  }

  if (Array.isArray(script.scenes) && script.scenes.length > MAX_SCENES) {
    problems.push(`scenes[] must have at most ${MAX_SCENES} scenes (got ${script.scenes.length})`);
  }

  const castIds = new Set(Object.keys(script.cast || {}));
  let totalDuration = 0;
  let sceneIndex = -1;
  for (const sc of script.scenes ?? []) {
    sceneIndex++;
    const where = (what: string) => `scene ${sceneIndex}${sc?.id ? ` (${sc.id})` : ''}: ${what}`;
    if (!sc || typeof sc !== 'object') {
      problems.push(where('must be an object'));
      continue;
    }
    if (!sc.id || typeof sc.id !== 'string') problems.push(where('id is required'));

    // Per-scene env override must also be a known environment.
    if (sc.env && !KNOWN_ENVIRONMENTS.has(sc.env.type)) {
      problems.push(where(`env.type "${sc.env.type}" is unknown (street, abstract, classroom)`));
    }

    const dialogue = Array.isArray(sc.dialogue) ? sc.dialogue : [];
    if (dialogue.length > 6) problems.push(where('has more than 6 dialogue lines; split it into another scene'));
    for (const d of dialogue) {
      if (!d || typeof d !== 'object') { problems.push(where('dialogue entries must be objects')); continue; }
      if (!d.who || typeof d.who !== 'string') problems.push(where('dialogue needs who'));
      else if (d.who !== 'narr' && !castIds.has(d.who)) {
        problems.push(where(`dialogue.who "${d.who}" is not in cast{} (or the literal "narr" for the narrator)`));
      }
      if (!d.text || typeof d.text !== 'string') problems.push(where('dialogue needs text'));
      else if (d.text.length > 400) problems.push(where('dialogue text is longer than 400 characters; split it'));
    }

    for (const a of sc.actions ?? []) {
      if (!a || typeof a !== 'object') { problems.push(where('actions entries must be objects')); continue; }
      if (!a.char || typeof a.char !== 'string') problems.push(where(`action ${a.do} needs char`));
      else if (!castIds.has(a.char)) problems.push(where(`action char "${a.char}" is not in cast{}`));
      if (!KNOWN_ACTIONS.has(a.do)) {
        problems.push(where(`unknown action "${a && a.do}" for ${a && a.char} (known: ${[...KNOWN_ACTIONS].join(', ')})`));
      }
      if ((a.do === 'walk' || a.do === 'run') && (typeof a.from !== 'number' || typeof a.to !== 'number')) {
        problems.push(where(`${a.do} needs numeric from and to (world x coordinates)`));
      }
      if (a.do === 'face' && a.facing !== 1 && a.facing !== -1) {
        problems.push(where('face needs facing: 1 or -1'));
      }
    }

    for (const o of sc.overlays ?? []) {
      if (!o || typeof o !== 'object') { problems.push(where('overlays entries must be objects')); continue; }
      if (!['arrows', 'formula', 'title'].includes(o.type)) {
        problems.push(where(`overlay type "${o.type}" is unknown (arrows, formula, title)`));
      }
      if (typeof o.t0 !== 'number' || typeof o.t1 !== 'number' || o.t1 <= o.t0) {
        problems.push(where('overlay needs numeric t0 < t1 (scene-relative seconds)'));
      }
    }

    const camera = Array.isArray(sc.camera) ? sc.camera : [];
    for (const c of camera) {
      if (!c || typeof c !== 'object') { problems.push(where('camera entries must be objects')); continue; }
      if (!['establish', 'focus', 'follow', 'twoShot', 'shake'].includes(c.do)) {
        problems.push(where(`camera intent "${c.do}" is unknown (establish, focus, follow, twoShot, shake)`));
      }
      if (c.do === 'focus' && (!Array.isArray(c.point) || c.point.length !== 2)) {
        problems.push(where('camera focus needs point: [x, y]'));
      }
      if (c.do === 'follow' && (!c.target || !castIds.has(c.target))) {
        problems.push(where(`camera follow target "${c.target}" is not in cast{}`));
      }
      if (c.do === 'twoShot' && (!Array.isArray(c.targets) || c.targets.some((t: string) => !castIds.has(t)))) {
        problems.push(where('camera twoShot needs targets: [charA, charB] from cast{}'));
      }
    }

    for (const p of sc.props ?? []) {
      if (!p || typeof p !== 'object') { problems.push(where('props entries must be objects')); continue; }
      if (!['box', 'easel', 'lamppost', 'bench', 'plant'].includes(p.type)) {
        problems.push(where(`prop type "${p.type}" is unknown (box, easel, lamppost, bench, plant)`));
      }
      if (typeof p.x !== 'number') problems.push(where(`prop ${p.id || ''} needs a numeric x position`));
    }

    for (const [id, c] of Object.entries<any>(sc.cast ?? {})) {
      if (!castIds.has(id)) problems.push(where(`scene cast member "${id}" is not defined in the top-level cast{}`));
      else if (c && typeof c.x !== 'number') problems.push(where(`scene cast.${id} needs a numeric starting x`));
    }

    // Rough duration budget so a runaway generation cannot block the fleet.
    if (typeof sc.duration === 'number') totalDuration += sc.duration;
    totalDuration += dialogue.length * 6;
  }

  if (totalDuration > MAX_DURATION_SECONDS) {
    problems.push(`the script is longer than ${MAX_DURATION_SECONDS / 60} minutes of video; split the lesson into two animations`);
  }
  return problems;
}
