import React from "react";
import ReactDOM from "react-dom";
import { Canvas } from "@react-three/fiber";
import { WiredBox } from "./WiredBox";
import { BasicLayerTilesExample } from "./BasicLayerTilesExample";
import { Suspense } from "react";

ReactDOM.render(
  <Canvas
    dpr={window.devicePixelRatio}
    camera={{ position: [0, 350, 500], near: 1, far: 8000 }}
  >
    <WiredBox width={640} height={20} depth={400} />
    <Suspense fallback={null}>
      <BasicLayerTilesExample />
    </Suspense>
  </Canvas>,
  document.getElementById("root")
);
