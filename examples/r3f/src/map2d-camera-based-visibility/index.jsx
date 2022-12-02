import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DemoOrDie } from "./map2d-camera-based-visibility";
import { SwitchCameraUI } from "./SwitchCameraUI";

const root = createRoot(document.getElementById("root"));

root.render(
  <>
    <Leva titleBar />
    <SwitchCameraUI />
    <Canvas dpr={[1, 2]} camera={{ position: [100, 350, 600], far: 25000 }}>
      <StrictMode>
        <DemoOrDie />
      </StrictMode>
    </Canvas>
  </>
);
