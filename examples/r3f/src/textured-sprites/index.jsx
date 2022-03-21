import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ReactDOM from "react-dom";
import { TexturedSpritesDemo } from "./TexturedSpritesDemo";

ReactDOM.render(
  <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 50] }}>
    <TexturedSpritesDemo capacity={300} />
    <OrbitControls />
  </Canvas>,
  document.getElementById("root")
);
