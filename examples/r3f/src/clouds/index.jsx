import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useControls } from "leva";
import { ParallaxProjection, Stage2D } from "twopoint5d-r3f";

import { createRoot } from "react-dom/client";
import { Clouds } from "./Clouds";

const root = createRoot(document.getElementById("root"));

const Demo = () => {
  const { speed, alpha } = useControls({
    speed: { value: 90, min: 0, max: 250, step: 1 },
    alpha: { value: 0.3, min: 0.01, max: 0.99, step: 0.01 },
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
          speed={speed}
          width={2500}
          height={600}
          yOffset={-600}
          zOffset={-660}
          fadeInRange={0.1}
          fadeOutRange={0.1}
          postAlphaMultiplier={alpha}
        />
      </Stage2D>

      <OrbitControls />
    </Canvas>
  );
};

root.render(<Demo />);
