import '@react-three/fiber';
import {useMemo, type FC, type PropsWithChildren} from 'react';
import {BoxGeometry} from 'three';

export interface WiredBoxProps extends PropsWithChildren<JSX.IntrinsicElements['lineSegments']> {
  width: number;
  height: number;
  depth: number;
  color?: number;
}

export const WiredBox: FC<WiredBoxProps> = ({width, height, depth, children, color = 0xf0f0f0, ...props}) => {
  const boxGeometry = useMemo(() => new BoxGeometry(width, height, depth), [width, height, depth]);

  return (
    <lineSegments {...props}>
      <edgesGeometry args={[boxGeometry]} />
      <lineBasicMaterial color={color} />
      {children}
    </lineSegments>
  );
};
