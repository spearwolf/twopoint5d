import React, { useMemo } from "react";
import { BoxGeometry } from "three";
import "@react-three/fiber";

export const WiredBox = ({ width, height, depth, children, ...props }) => {
  const boxGeometry = useMemo(
    () => new BoxGeometry(width, height, depth),
    [width, height, depth]
  );
  return (
    <lineSegments {...props}>
      <edgesGeometry args={[boxGeometry]} />
      <lineBasicMaterial color={0xf0f0f0} />
      {children}
    </lineSegments>
  );
};
