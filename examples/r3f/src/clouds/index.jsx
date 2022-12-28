import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { ParallaxProjection, Stage2D } from "twopoint5d-r3f";
import { createRoot } from "react-dom/client";
import { Clouds } from "./Clouds";

const root = createRoot(document.getElementById("root"));

root.render(
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
        fadeInRange={0.1}
        fadeOutRange={0.1}
      />
    </Stage2D>

    <OrbitControls />
  </Canvas>
);
