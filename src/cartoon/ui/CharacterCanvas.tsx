"use client";
// Character preview canvas — renders the actual production CharacterRig
// (same code path as the video engine) for the cast editor.
import React from "react";
import { CharacterRig } from "../engine/characters/CharacterRig";
import { resolveDNA } from "../engine/characters/presets";
import type { CharacterDNA, Expression, Action } from "../engine/types";

export function CharacterCanvas({ dna, expression = "happy", action = "idle", talking = false, width = 220, flip = false, animate = true }: {
  dna: Partial<CharacterDNA>;
  expression?: Expression;
  action?: Action;
  talking?: boolean;
  width?: number;
  flip?: boolean;
  animate?: boolean;
}) {
  const full = resolveDNA(undefined, dna as CharacterDNA);
  const t0 = React.useRef(0);
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    if (!animate) return;
    let raf = 0;
    t0.current = performance.now();
    const loop = () => {
      setT((performance.now() - t0.current) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  return (
    <svg viewBox="0 0 400 680" width={width} height={(width * 680) / 400} style={{ overflow: "visible" }}>
      <ellipse cx={200} cy={648} rx={110} ry={14} fill="rgba(20,20,40,0.08)" />
      <CharacterRig
        dna={full}
        expression={expression}
        action={action}
        talkOpen={talking ? 0.4 + 0.4 * Math.abs(Math.sin(t * 8)) : 0}
        t={t}
        scale={1}
        x={200}
        y={620}
        blinkSeed={2}
        flip={flip}
      />
    </svg>
  );
}
