// Shared Visual Asset Library placements inside a scene (engine side).
// Renders each attached asset with a spring pop-in and a gentle float so
// library assets feel native to the cartoon world (not pasted images).
import React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneAssetProp } from "../types";
import { mediaSrc } from "../mediaSrc";

export const ASSET_PROP_BASE = 240; // px at scale 1 on a 1080-wide canvas

export const AssetPropsLayer: React.FC<{
  assets: SceneAssetProp[];
  W: number;
  H: number;
  sceneId: string;
}> = ({ assets, W, H, sceneId }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const base = ASSET_PROP_BASE * (H / 1920) * (W >= H ? W / 1080 : 1);

  if (!assets || assets.length === 0) return null;

  return (
    <>
      {assets.slice(0, 4).map((a, i) => {
        const popAt = a.popAt ?? 0;
        const pop = spring({
          frame: frame - Math.round(popAt * fps),
          fps,
          config: { damping: 12, stiffness: 150, mass: 0.6 },
        });
        if (pop <= 0.001) return null;
        const s = (a.scale ?? 1) * base;
        const bob = Math.sin(t * 1.7 + i * 1.9 + sceneId.length) * 6 * (H / 1920);
        const tilt = Math.sin(t * 1.1 + i) * 1.6;
        const fade = interpolate(pop, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
        return (
          <div
            key={a.assetId + i}
            style={{
              position: "absolute",
              left: `${(a.x / 1000) * 100}%`,
              top: `${(a.y / 1000) * 100}%`,
              width: s,
              marginLeft: -s / 2,
              marginTop: -(s / 2) + bob,
              transform: `scale(${0.4 + 0.6 * pop}) rotate(${tilt}deg)`,
              transformOrigin: "center center",
              opacity: fade,
              filter: "drop-shadow(0 10px 14px rgba(20, 12, 48, 0.28))",
              pointerEvents: "none",
            }}
          >
            <Img src={mediaSrc(a.url)} style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
        );
      })}
    </>
  );
};
