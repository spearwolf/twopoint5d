import { Canvas } from "@react-three/fiber";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DemoOrDie } from "./map2d-camera-based-visibility";
import { SwitchCameraUI } from "./SwitchCameraUI";

const root = createRoot(document.getElementById("root"));

root.render(
  <>
    <SwitchCameraUI />
    <Canvas dpr={[1, 2]} camera={{ position: [0, 350, 500], far: 8000 }}>
      <StrictMode>
        <DemoOrDie />
      </StrictMode>
    </Canvas>
  </>
);
