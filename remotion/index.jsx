import React from "react";
import { registerRoot, Composition } from "remotion";
import { CartoonVideo, totalDuration } from "../src/cartoon/engine/CartoonVideo";

const Root = () => {
  return (
    <Composition
      id="CartoonVideo"
      component={CartoonVideo}
      durationInFrames={30 * 60}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        spec: {
          title: "Test", description: "", caption: "", hashtags: [], music: "none",
          characters: [{ ref: "tobi", name: "Tobi", presetKey: "tobi" }],
          scenes: [{
            id: "s1", heading: "Test", narration: "Hello from the cartoon engine.",
            visualConcept: "park", layout: "focus-center",
            cast: [{ ref: "tobi", action: "wave", expression: "happy", x: 500, y: 800, scale: 1, speaking: true }],
            props: [], camera: "none", transition: "fade",
          }],
        },
        narration: {},
        orientation: "9:16",
      }}
      calculateMetadata={({ props }) => {
        const total = totalDuration(props);
        const o = props.orientation;
        const size = o === "9:16" ? { width: 1080, height: 1920 } : o === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1080 };
        return {
          durationInFrames: Math.max(30, Math.ceil(total * 30)),
          ...size,
        };
      }}
    />
  );
};

registerRoot(Root);
