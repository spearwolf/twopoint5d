import {extend, ReactThreeFiber, useFrame, useThree} from '@react-three/fiber';
import {Stage2D as __Stage2D} from '@spearwolf/stage25';
import {createContext, forwardRef, Ref, useCallback, useContext, useEffect, useState} from 'react';
import {Camera, WebGLRenderer} from 'three';
import {mergeRefs} from '../utils/mergeRefs';

extend({Stage2D: __Stage2D});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      stage2D: ReactThreeFiber.Node<__Stage2D, typeof __Stage2D>;
    }
  }
}

export const Stage2DContext = createContext<__Stage2D>(undefined);
Stage2DContext.displayName = 'Stage2DContext';

export type Stage2DProps = JSX.IntrinsicElements['stage2D'] & {
  renderPriority?: number;
  noAutoClear?: boolean;
  defaultCamera?: boolean;
};

function Component(
  {scene, projection, renderPriority, noAutoClear, defaultCamera, children, ...props}: Stage2DProps,
  ref: Ref<__Stage2D>,
) {
  const canvasSize = useThree((state) => state.size);
  const setThreeDefault = useThree((state) => state.set);

  const [stage, setStage] = useState<__Stage2D>(null);
  const scenePrimitive = (scene || stage?.scene) ?? null;

  const [initialScene] = useState(scene);
  const [initialProjection] = useState(projection);

  const [stageCamera, setStageCamera] = useState<Camera>(stage?.camera);

  const parentStage = useContext(Stage2DContext);

  useEffect(() => {
    if (stage?.camera) {
      setStageCamera(stage.camera);
    }
    return stage?.on('afterCameraChanged', ({camera}) => setStageCamera(camera));
  }, [stage]);

  useEffect(() => {
    if (defaultCamera && stageCamera) {
      setThreeDefault({camera: stageCamera as any});
    }
  }, [stageCamera, defaultCamera, setThreeDefault]);

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

  const renderFrame = useCallback(
    (gl: WebGLRenderer) => {
      // TODO StageRenderer -> StageDirector...
      if (stage && !parentStage) {
        const wasPreviouslyAutoClear = gl.autoClear;
        gl.autoClear = !noAutoClear;

        gl.render(stage.scene, stage.camera);

        gl.autoClear = wasPreviouslyAutoClear;
      }
    },
    [stage, parentStage, noAutoClear],
  );

  useFrame(({gl}) => renderFrame(gl), renderPriority ?? 0);

  return (
    <stage2D args={[initialProjection, initialScene]} ref={mergeRefs(setStage, ref)} {...props}>
      <Stage2DContext.Provider value={stage}>
        {stage && scenePrimitive && <primitive object={scenePrimitive}>{children}</primitive>}
      </Stage2DContext.Provider>
    </stage2D>
  );
}

Component.displayName = 'Stage2D';

export const Stage2D = forwardRef<__Stage2D, Stage2DProps>(Component);
