import {extend, ReactThreeFiber, useThree} from '@react-three/fiber';
import {Stage2D as __Stage2D} from '@spearwolf/stage25';
import {createContext, forwardRef, Ref, useContext, useEffect, useState} from 'react';
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

export const Stage2DContext = createContext<__Stage2D>(undefined);
Stage2DContext.displayName = 'Stage2DContext';

export type Stage2DParams = {} & JSX.IntrinsicElements['stage2D'];

function Component({scene, projection, children, ...props}: Stage2DParams, ref: Ref<__Stage2D>) {
  const canvasSize = useThree((state) => state.size);
  const [stage, setStage] = useState<__Stage2D>(null);

  const [initialScene] = useState(scene);
  const [initialProjection] = useState(projection);

  const parentStage = useContext(Stage2DContext);

  useEffect(() => {
    if (!stage) return;

    if (parentStage) {
      stage.resize(parentStage.width, parentStage.height);
    } else {
      stage.resize(canvasSize.width, canvasSize.height);
    }

    console.log('stage', {
      width: stage.width,
      height: stage.height,
      containerWidth: stage.containerWidth,
      containerHeight: stage.containerHeight,
      stage,
      parentStage,
    });

    return parentStage?.on('resize', ({width, height}) => {
      stage.resize(width, height);

      console.log('stage[parentStage:resize]', {
        width: stage.width,
        height: stage.height,
        containerWidth: stage.containerWidth,
        containerHeight: stage.containerHeight,
        stage,
        parentStage,
      });
    });
  }, [stage, parentStage, canvasSize.width, canvasSize.height]);

  const scenePrimitive = (scene || stage?.scene) ?? null;

  return (
    <stage2D args={[initialProjection, initialScene]} ref={mergeRefs(setStage, ref)} {...props}>
      <Stage2DContext.Provider value={stage}>
        {stage && scenePrimitive && <primitive object={scenePrimitive}>{children}</primitive>}
      </Stage2DContext.Provider>
    </stage2D>
  );
}

Component.displayName = 'Stage2D';

export const Stage2D = forwardRef<__Stage2D, Stage2DParams>(Component);
