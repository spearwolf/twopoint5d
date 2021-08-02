import React from "react";
import ReactDOM from "react-dom";
import { Crosses } from "./Crosses";
import { ResponsiveCanvas } from "r3f-vertex-objects";

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
  <ResponsiveCanvas>
    <Crosses capacity={10} color={0x990033} onCreateGeometry={makeCrosses} />
  </ResponsiveCanvas>,
  document.getElementById("root")
);
