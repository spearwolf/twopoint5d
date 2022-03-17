import React from "react";
import { Canvas } from "@react-three/fiber";
import ReactDOM from "react-dom";
import { Crosses } from "./Crosses";

const makeCrosses = (geometry) => {
  console.log("vertexObjectGeometry", geometry);

  const size = 3;
  const offset = 1.2;
  const { capacity } = geometry.pool;

  for (let i = 0; i < capacity; i++) {
    const cross = geometry.pool.createVO();
    cross.make(size, size);
    cross.rotate(i * 45);
    cross.translate(
      i * size * offset - ((capacity - 1) * size * offset) / 2,
      0
    );
  }
};

ReactDOM.render(
  <Canvas dpr={[1, 2]}>
    <Crosses capacity={10} color={0x990033} onCreateGeometry={makeCrosses} />
  </Canvas>,
  document.getElementById("root")
);
