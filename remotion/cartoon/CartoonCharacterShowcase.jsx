import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CharacterRig } from './CharacterRig';
import { AnimatedCharacter } from './AnimatedCharacter';
import { getCharacterPreset } from './characterPresets';

const C = { ink: '#243247', blue: '#1769AA', cream: '#FFF4E2', yellow: '#F5C451' };
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

function Classroom({ children }) {
  return <AbsoluteFill style={{ background: '#EAF3F8', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: '0 0 28%', background: '#F7FBFD' }} />
    <div style={{ position: 'absolute', left: '8%', top: '12%', width: '34%', height: '26%', background: '#BFE0EC', border: '12px solid #8D6546', borderRadius: 8 }}>
      <div style={{ position: 'absolute', inset: '12%', border: '5px solid #fff9', borderRadius: 4 }} />
    </div>
    <div style={{ position: 'absolute', right: '10%', top: '14%', width: '30%', height: '22%', background: '#176044', border: '10px solid #A77B53', borderRadius: 8 }} />
    <div style={{ position: 'absolute', right: '14%', top: '19%', color: '#F7F1D6', fontSize: 26, fontWeight: 900, transform: 'rotate(-4deg)' }}>BIOLOGY</div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: '23%', height: 22, background: '#D8B78D' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '24%', background: '#B9895D' }} />
    {children}
  </AbsoluteFill>;
}

function Outdoor({ children }) {
  return <AbsoluteFill style={{ background: 'linear-gradient(#A9D8F4 0%, #E8F6FC 65%, #8DBD75 65%, #6B9B5B 100%)', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: '9%', bottom: '21%', width: 160, height: 190, background: '#F2D7A8', border: '7px solid #8A6046' }} />
    <div style={{ position: 'absolute', left: '5%', bottom: '42%', width: 240, height: 120, background: '#C86F52', clipPath: 'polygon(50% 0,100% 100%,0 100%)' }} />
    <div style={{ position: 'absolute', right: '12%', bottom: '23%', width: 130, height: 210, background: '#6C9E65', borderRadius: '50% 50% 12% 12%' }} />
    <div style={{ position: 'absolute', right: '15%', bottom: '50%', width: 65, height: 65, background: '#4D8050', borderRadius: '50%' }} />
    {children}
  </AbsoluteFill>;
}

function Caption({ children }) {
  return <div style={{ position: 'absolute', left: '7%', right: '7%', bottom: '6%', padding: '22px 28px', borderRadius: 22, background: '#102B4EED', color: 'white', fontSize: 34, fontWeight: 800, lineHeight: 1.18, textAlign: 'center', boxShadow: '0 8px 24px #102b4e33' }}>{children}</div>;
}

function CharacterAt({ character, expression, pose, action, speaking, left, width = '42%' }) {
  return <div style={{ position: 'absolute', bottom: '13%', left, width, height: '72%' }}>
    <CharacterRig character={character} expression={expression} pose={pose} action={action} speaking={speaking} />
  </div>;
}

function SceneOne() {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, 45], [-55, 0], clamp);
  return <Classroom>
    <div style={{ position: 'absolute', left: '36%', bottom: '16%', width: '28%', height: 90, background: '#A8794E', borderRadius: 12, border: '8px solid #80583D' }} />
    <div style={{ position: 'absolute', left: '41%', bottom: '20%', width: '18%', height: 25, background: '#F8E6B6', borderRadius: 4, transform: 'rotate(-5deg)' }} />
    <div style={{ position: 'absolute', left: '25%', bottom: '13%', width: '48%', height: '77%', transform: `translateX(${x}px)` }}>
      <AnimatedCharacter character={getCharacterPreset('tobi')} defaultExpression="happy" cues={[{ from: 0, duration: 45, action: "walk", pose: "walking", x: -55 }, { from: 45, duration: 195, action: "idle", expression: "neutral" }]} />
    </div>
    <Caption>Tobi walked into the classroom, ready for Biology.</Caption>
  </Classroom>;
}

function SceneTwo() {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, 20], [.92, 1], clamp);
  return <Classroom>
    <div style={{ position: 'absolute', left: '27%', bottom: '13%', width: '46%', height: '77%', transform: `scale(${scale})` }}>
      <CharacterRig character={getCharacterPreset('tobi')} expression="confused" pose="standing" action="idle" />
    </div>
    <div style={{ position: 'absolute', right: '13%', top: '44%', padding: '20px 28px', borderRadius: 20, background: 'white', color: C.ink, fontSize: 30, fontWeight: 900, boxShadow: '0 6px 20px #24324722' }}>Mitochondria?</div>
    <Caption>But one question on the board left him completely confused.</Caption>
  </Classroom>;
}

function SceneThree() {
  return <Outdoor>
    <CharacterAt character={getCharacterPreset('tobi')} expression="happy" pose="waving" action="wave" speaking left="27%" width="43%" />
    <div style={{ position: 'absolute', right: '8%', bottom: '16%', width: '35%', height: '68%' }}>
      <CharacterRig character={{ ...getCharacterPreset('tobi'), palette: { ...getCharacterPreset('tobi').palette, hoodie: '#D58B32', hoodieLight: '#F2B65D', hoodieDark: '#A95D20', hair: '#5B3328' } }} expression="happy" pose="standing" />
    </div>
    <Caption>His friend came over and offered to explain.</Caption>
  </Outdoor>;
}

function SceneFour() {
  const f = useCurrentFrame();
  const pulse = interpolate(Math.sin(f / 5), [-1, 1], [.96, 1.04]);
  return <AbsoluteFill style={{ background: '#FFF6E7', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: '8%', top: '12%', color: C.blue, fontSize: 28, fontWeight: 900, letterSpacing: 4 }}>THE BIG IDEA</div>
    <div style={{ position: 'absolute', left: '18%', top: '23%', width: '64%', height: '42%', transform: `scale(${pulse})` }}>
      <svg viewBox="0 0 500 300" width="100%" height="100%">
        <path d="M80 155 C35 110 85 40 155 68 C190 8 285 38 285 90 C360 52 440 112 405 178 C445 245 360 285 300 245 C235 300 150 260 150 225 C90 255 45 205 80 155Z" fill="#E89A72" stroke="#6E3C32" strokeWidth="10" />
        <path d="M100 155 Q170 100 220 165 T350 145 M150 220 Q210 170 270 225 T380 190" fill="none" stroke="#A94F43" strokeWidth="9" strokeLinecap="round" />
      </svg>
    </div>
    <div style={{ position: 'absolute', left: '16%', right: '16%', top: '67%', textAlign: 'center', color: C.ink, fontSize: 42, fontWeight: 900 }}>Mitochondria release energy for the cell.</div>
    <Caption>Now Tobi understood: mitochondria help release usable energy.</Caption>
  </AbsoluteFill>;
}

export function CartoonCharacterShowcase() {
  const { fps } = useVideoConfig();
  const seconds = 8;
  return <AbsoluteFill style={{ background: C.cream, fontFamily: 'Arial, sans-serif' }}>
    <Sequence from={0} durationInFrames={seconds * fps}><SceneOne /></Sequence>
    <Sequence from={seconds * fps} durationInFrames={seconds * fps}><SceneTwo /></Sequence>
    <Sequence from={seconds * fps * 2} durationInFrames={seconds * fps}><SceneThree /></Sequence>
    <Sequence from={seconds * fps * 3} durationInFrames={seconds * fps}><SceneFour /></Sequence>
  </AbsoluteFill>;
}
