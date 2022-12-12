import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DemoOrDie } from "./parallax-simple-kastani";

const root = createRoot(document.getElementById("root"));

root.render(
  <>
    <Leva titleBar />
    <Canvas dpr={[1, 2]} camera={{ position: [100, 350, 600], far: 25000 }}>
      <StrictMode>
        <DemoOrDie />
      </StrictMode>
    </Canvas>
  </>
);
