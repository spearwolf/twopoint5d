import {extend, ReactThreeFiber, useFrame} from '@react-three/fiber';
import {FunctionComponent, useRef} from 'react';
import {Object3D} from 'three';
import {Map2d} from 'three-tiled-maps';

extend({Map2d});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      map2d: ReactThreeFiber.Object3DNode<Map2d, typeof Map2d>;
    }
  }
}

const addToParent = (self: Map2d, parent: Object3D) => {
  parent.add(self.obj3d);
};

const removeFromParent = (self: Map2d) => self.obj3d.removeFromParent();

export type Map2DProps = {
  name?: string;
};

export const Map2D: FunctionComponent<Map2DProps> = ({children, ...props}) => {
  const ref = useRef<Map2d>();

  useFrame(() => {
    ref.current?.update();
  });

  return (
    <map2d {...props} ref={ref} attachFns={[addToParent, removeFromParent]}>
      {children}
    </map2d>
  );
};

Map2D.defaultProps = {
  name: 'Map2D',
};
