import { extend, useFrame } from "@react-three/fiber";
import { Map2d } from "three-tiled-maps";
import React, { useRef } from "react";

extend({ Map2d });

export const Map2D = ({ children, ...props }) => {
  const ref = useRef();

  useFrame(() => {
    ref.current?.update();
  });

  return (
    <map2d
      {...props}
      ref={ref}
      attachFns={[
        (self, parent) => {
          parent.add(self.obj3d);
          console.log("attach map2d", self);
        },
        (self) => self.obj3d.removeFromParent(),
      ]}
    >
      {children}
    </map2d>
  );
};

Map2D.defaultProps = {
  name: "Map2D",
};
