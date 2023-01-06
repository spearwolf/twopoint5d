import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { Perf } from "r3f-perf";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { CrossHair } from "../utils/CrossHair";
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
      <Perf position="top-left" style={{ transform: "scale(0.8)" }} />
    </Canvas>
    <CrossHair />
  </>
);
