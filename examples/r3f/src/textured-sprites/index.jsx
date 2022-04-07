import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { createRoot } from "react-dom/client";
import { TexturedSpritesDemo } from "./TexturedSpritesDemo";

const root = createRoot(document.getElementById("root"));

root.render(
  <Canvas linear flat dpr={[1, 2]} camera={{ position: [0, 0, 50] }}>
    <TexturedSpritesDemo capacity={500} />
    <OrbitControls />
  </Canvas>
);
