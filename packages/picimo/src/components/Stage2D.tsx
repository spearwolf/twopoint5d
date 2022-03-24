import {extend, ReactThreeFiber, useThree} from '@react-three/fiber';
import {Stage2D as __Stage2D} from '@spearwolf/stage25';
import {forwardRef, Ref, useEffect, useState} from 'react';
import {mergeRefs} from '../utils/mergeRefs';

extend({Stage2D: __Stage2D});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      stage2D: ReactThreeFiber.Object3DNode<__Stage2D, typeof __Stage2D & JSX.IntrinsicElements['primitive']>;
    }
  }
}

export type Stage2DParams = {} & JSX.IntrinsicElements['stage2D'];

function Component({children, ...props}: Stage2DParams, ref: Ref<__Stage2D>) {
  const canvasSize = useThree((state) => state.size);
  const [stage, setStage] = useState<__Stage2D>();

  useEffect(() => {
    stage?.resize(canvasSize.width, canvasSize.height);
    console.log('canvas-size', canvasSize.width, canvasSize.height, stage);
  }, [stage, canvasSize.width, canvasSize.height]);

  return (
    <stage2D ref={mergeRefs(setStage, ref)} {...props}>
      {children}
    </stage2D>
  );
}

Component.displayName = 'Stage2D';

export const Stage2D = forwardRef<__Stage2D, Stage2DParams>(Component);
