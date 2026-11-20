// CartoonVideo — the root Remotion composition of the Cartoon Animation Studio.
// Assembles scenes: concept background -> props -> characters -> bubbles/labels ->
// camera -> subtitles -> audio + music, with per-scene transitions.
import React from "react";
import {
  AbsoluteFill, Audio, Sequence, interpolate,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import type { CartoonProjectProps, SceneCastMember, StoryboardScene, CharacterDNA } from "./types";
import { resolveDNA } from "./characters/presets";
import { CharacterRig } from "./characters/CharacterRig";
import { VisualConceptBackground } from "./scenes/concepts";
import { Prop, PROP_RENDER_SIZE } from "./scenes/props";
import { AssetPropsLayer } from "./scenes/assetProps";
import {
  SpeechBubble, LabelChip, Confetti, Sparkles, TransitionOverlay,
  cameraTransform, SubtitleBar, BrandWatermark,
} from "./fx";
import { spring } from "remotion";
import { BRAND } from "./palette";
import { mediaSrc } from "./mediaSrc";

// Fonts use the SBA global font stack; no extra font binaries are required.
const LEAD = 0.35; // silence before narration in each scene
const TAIL = 0.45; // pad after narration

export { mediaSrc }; // re-exported for existing imports

// word-level lip-sync openness for a speaking character
function lipSyncAt(localT: number, words: { word: string; start: number; end: number }[], seed: number): number {
  if (words.length === 0) return 0;
  let active = false;
  let k = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (localT >= w.start && localT <= w.end + 0.03) { active = true; k = i; break; }
  }
  if (!active) {
    // small closing motion right after a word ends
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (localT > w.end && localT < w.end + 0.12) return 0.12 * (1 - (localT - w.end) / 0.12);
    }
    return 0.04;
  }
  const w = words[k];
  const p = (localT - w.start) / Math.max(0.05, w.end - w.start);
  const osc = Math.abs(Math.sin(p * Math.PI * (1.4 + (seed % 3) * 0.35)));
  return 0.25 + 0.75 * osc;
}

// scene duration in seconds (from narration, with pads)
export function sceneDuration(scene: StoryboardScene, narration: CartoonProjectProps["narration"]): number {
  const n = narration[scene.id];
  const spoken = n?.durationSeconds ?? estimateDuration(scene.narration);
  return LEAD + spoken + TAIL;
}

export function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(2.2, words / 2.55); // ~153 wpm measured from our TTS
}

export function totalDuration(props: CartoonProjectProps): number {
  return props.spec.scenes.reduce((acc, s) => acc + sceneDuration(s, props.narration), 0);
}

// ---------- single scene ----------
const CartoonScene: React.FC<{
  scene: StoryboardScene;
  dnas: Record<string, CharacterDNA>;
  narration: CartoonProjectProps["narration"];
  W: number; H: number;
  index: number;
  subtitles: boolean;
  isLast: boolean;
}> = ({ scene, dnas, narration, W, H, index, subtitles, isLast }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const n = narration[scene.id];
  const dur = sceneDuration(scene, narration);

  const cam = cameraTransform(scene.camera, t, dur);

  // layout default positions/scales per ratio
  const charBaseScale = H / 1500; // character height ~0.55H at scale 1
  const propBaseScale = H / 1100;

  const speakingWords = n?.words ?? [];
  const seedBase = scene.id.length + index * 7;

  const exitT = dur - t; // time left in scene

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `scale(${cam.scale}) translate(${cam.tx}px ${cam.ty}px)`,
          transformOrigin: "center center",
        }}
      >
        {/* background world */}
        <AbsoluteFill>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
            <VisualConceptBackground concept={scene.visualConcept} W={W} H={H} t={t} seed={scene.id} label={scene.heading} />
          </svg>
        </AbsoluteFill>

        {/* auto-positioned chairs: snap under any sitting character */}
        {(() => {
          const sitters = scene.cast.filter((c) => c.action === "sit");
          return scene.props.map((p, i) => {
            let px = p.x, py = p.y, psc = p.scale ?? 1;
            if (p.kind === "chair" && sitters.length > 0) {
              const s = sitters[i % sitters.length];
              const cs = (s.scale ?? 1) * charBaseScale;
              px = s.x;
              py = s.y - (196 / 620) * 620 * cs * (1000 / H) + 16 * cs * (1000 / H);
              psc = cs * (1000 / H) * 1.25;
            }
            const popT = p.popAt ?? 0;
            const pop = popT > 0 ? interpolate(t, [popT, popT + 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
            if (pop <= 0) return null;
            const s = psc * pop * (PROP_RENDER_SIZE[p.kind] ?? 1);
            return (
              <svg key={i} viewBox="0 0 200 200" style={{
                position: "absolute",
                left: `${(px / 1000) * 100}%`,
                top: `${(py / 1000) * 100}%`,
                width: 200 * propBaseScale * s,
                height: 200 * propBaseScale * s,
                marginLeft: -100 * propBaseScale * s,
                marginTop: -100 * propBaseScale * s,
                overflow: "visible",
              }}>
                <Prop kind={p.kind} t={t} seed={scene.id + i} />
              </svg>
            );
          });
        })()}

        {/* Shared Visual Asset Library placements (section 7) */}
        <AssetPropsLayer assets={scene.customAssets ?? []} W={W} H={H} sceneId={scene.id} />

        {/* characters */}
        {scene.cast.map((c: SceneCastMember, i) => {
          const dna = dnas[c.ref];
          if (!dna) return null;
          const enter = spring({
            frame: frame - i * 4,
            fps,
            config: { damping: 15, stiffness: 140, mass: 0.65 },
          });
          const talkOpen = c.speaking ? lipSyncAt(t - LEAD, speakingWords, seedBase + i) : 0;
          const charScale = (c.scale ?? 1) * charBaseScale;
          const flip = c.x > 500; // characters on the right face left by default
          return (
            <svg key={c.ref} viewBox="0 0 400 660" style={{
              position: "absolute",
              left: `${(c.x / 1000) * 100}%`,
              top: `${(c.y / 1000) * 100}%`,
              width: 400 * charScale,
              height: 660 * charScale,
              marginLeft: -200 * charScale,
              marginTop: -620 * charScale,
              transform: `scale(${0.6 + 0.4 * enter})`,
              transformOrigin: "50% 100%",
              overflow: "visible",
              opacity: Math.min(1, enter * 1.6),
            }}>
              <CharacterRig
                dna={dna}
                expression={c.expression}
                action={c.action}
                talkOpen={talkOpen}
                t={t}
                blinkSeed={seedBase + i}
                scale={1}
                x={200}
                y={620}
                flip={flip}
              />
            </svg>
          );
        })}

        {/* foreground FX */}
        {index === 0 && <Sparkles t={t} seed={scene.id} W={W} H={H} n={7} />}
        {isLast && <Confetti t={Math.max(0, t - 0.3)} seed={scene.id} W={W} H={H} n={46} originX={0.5} originY={0.22} />}

        {/* heading chip */}
        {scene.heading && (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <LabelChip x={W / 2} y={H * 0.085} text={scene.heading.slice(0, 34)} t={t} color={BRAND.blue} fontSize={H * 0.028} />
          </svg>
        )}

        {/* speech bubble for a single speaking character (when narration is short) */}
        {(() => {
          const speakers = scene.cast.filter((c) => c.speaking);
          if (speakers.length !== 1 || !scene.onScreenText) return null;
          const s = speakers[0];
          const dna = dnas[s.ref];
          if (!dna) return null;
          const headY = s.y - 620 * (s.scale ?? 1) * charBaseScale - 40 * charBaseScale;
          return (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
              <SpeechBubble
                x={(s.x / 1000) * W}
                y={headY}
                text={scene.onScreenText.slice(0, 60)}
                t={t}
                scale={Math.min(1.6, W / 900)}
                flip={s.x > 500}
              />
            </svg>
          );
        })()}
      </AbsoluteFill>

      {/* subtitles */}
      <SubtitleBar
        W={W} H={H}
        text={scene.narration}
        progress={n ? Math.min(1, Math.max(0, (t - LEAD) / Math.max(0.001, n.durationSeconds))) : 0}
        t={t}
        active={subtitles}
      />

      {isLast && <BrandWatermark W={W} H={H} />}

      {/* transitions (enter at scene start, exit at scene end) */}
      <TransitionOverlay kind={scene.transition} t={t} W={W} H={H} entering />
      <TransitionOverlay kind={scene.transition} t={exitT} W={W} H={H} entering={false} />

      {/* narration audio */}
      {n && n.audioUrl && <Audio src={mediaSrc(n.audioUrl)} startFrom={0} />}
    </AbsoluteFill>
  );
};

// ---------- root ----------
export const CartoonVideo: React.FC<CartoonProjectProps> = (props) => {
  const { spec, narration, orientation } = props;
  const { width: W, height: H, fps } = useVideoConfig();

  // resolve character DNAs (preset or custom), also referenced by scenes
  const dnas: Record<string, CharacterDNA> = {};
  for (const ch of spec.characters) dnas[ch.ref] = resolveDNA(ch.presetKey, ch.dna);

  // durations
  const durations = spec.scenes.map((s) => sceneDuration(s, narration));
  const total = durations.reduce((a, b) => a + b, 0);

  // background music (staticFile works in Player AND server render bundle)
  // SBA master does not yet contain the source branch music files. Keep the
  // render deterministic and avoid broken staticFile references until a
  // licensed/shared music pack is added to the production public directory.
  const musicFile = null;

  return (
    <AbsoluteFill style={{ background: BRAND.paper }}>
      {spec.scenes.map((scene, i) => {
        const from = durations.slice(0, i).reduce((a, b) => a + b, 0);
        const dur = durations[i];
        return (
          <Sequence key={scene.id} from={Math.round(from * fps)} durationInFrames={Math.round(dur * fps)} name={scene.heading || `Scene ${i + 1}`}>
            <CartoonScene
              scene={scene}
              dnas={dnas}
              narration={narration}
              W={W}
              H={H}
              index={i}
              subtitles={props.subtitles ?? false}
              isLast={i === spec.scenes.length - 1}
            />
          </Sequence>
        );
      })}

      {/* background music, looped quietly */}
      {musicFile && (
        <Audio src={musicFile} loop volume={(f) => {
          const tt = f / fps;
          const fadeIn = interpolate(tt, [0, 1.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const fadeOut = interpolate(tt, [total - 1.2, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return 0.14 * Math.min(fadeIn, fadeOut);
        }} />
      )}
    </AbsoluteFill>
  );
};

export default CartoonVideo;
