import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TexturedSpritesDemo } from "./TexturedSpritesDemo";

const root = createRoot(document.getElementById("root"));

root.render(
  <Canvas linear flat dpr={[1, 2]} camera={{ position: [0, 0, 50] }}>
    <StrictMode>
      <TexturedSpritesDemo capacity={500} />
      <OrbitControls />
    </StrictMode>
  </Canvas>
);
