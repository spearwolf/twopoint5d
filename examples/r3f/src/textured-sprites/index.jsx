import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ReactDOM from "react-dom";
import { TexturedSpritesDemo } from "./TexturedSpritesDemo";
import { WiredBox } from "../utils/WiredBox";

ReactDOM.render(
  <Canvas dpr={[1, 2]}>
    <TexturedSpritesDemo capacity={400} />
    <WiredBox width={1} height={1} depth={1} />
    <OrbitControls />
  </Canvas>,
  document.getElementById("root")
);
