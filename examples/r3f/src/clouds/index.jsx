import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { createRoot } from "react-dom/client";
import { Clouds } from "./Clouds";
import { ParallaxProjection, Stage2D } from "picimo";

const root = createRoot(document.getElementById("root"));

root.render(
  <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 50] }}>
    <Stage2D name="stage1" defaultCamera renderPriority={1}>
      <ParallaxProjection
        plane="xy"
        origin="bottom left"
        width={1920}
        height={1080}
        fit="contain"
      />

      <Clouds
        capacity={200}
        gap={10}
        speed={90}
        width={1920}
        height={400}
        yOffset={-400}
        zOffset={-660}
        fadeInRange={0.1}
        fadeOutRange={0.1}
      />
    </Stage2D>
    <OrbitControls />
  </Canvas>
);
