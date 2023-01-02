import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useControls } from "leva";
import { ParallaxProjection, Stage2D } from "twopoint5d-r3f";

import { createRoot } from "react-dom/client";
import { Clouds } from "./Clouds";

const root = createRoot(document.getElementById("root"));

const Demo = () => {
  const { fadeInRange, fadeOutRange, postAlphaMultiplier } = useControls({
    fadeInRange: { value: 0.1, min: 0.01, max: 0.99, step: 0.01 },
    fadeOutRange: { value: 0.1, min: 0.01, max: 0.99, step: 0.01 },
    postAlphaMultiplier: { value: 0.3, min: 0.01, max: 0.99, step: 0.01 },
  });

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 50] }}>
      <Stage2D name="stage1" defaultCamera renderPriority={1}>
        <ParallaxProjection
          plane="xy"
          origin="bottom left"
          width={1024}
          height={768}
          fit="contain"
        />

        <Clouds
          capacity={800}
          gap={2}
          speed={90}
          width={2500}
          height={600}
          yOffset={-600}
          zOffset={-660}
          fadeInRange={fadeInRange}
          fadeOutRange={fadeOutRange}
          postAlphaMultiplier={postAlphaMultiplier}
        />
      </Stage2D>

      <OrbitControls />
    </Canvas>
  );
};

root.render(<Demo />);
