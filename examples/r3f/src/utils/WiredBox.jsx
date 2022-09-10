import "@react-three/fiber";
import { useMemo } from "react";
import { BoxGeometry } from "three";

export const WiredBox = ({
  width,
  height,
  depth,
  children,
  color = 0xf0f0f0,
  ...props
}) => {
  const boxGeometry = useMemo(
    () => new BoxGeometry(width, height, depth),
    [width, height, depth]
  );

  return (
    <lineSegments {...props}>
      <edgesGeometry args={[boxGeometry]} />
      <lineBasicMaterial color={color} />
      {children}
    </lineSegments>
  );
};
