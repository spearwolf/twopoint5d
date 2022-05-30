import {extend, ReactThreeFiber, useFrame, useThree} from '@react-three/fiber';
import {Stage2D as __Stage2D} from '@spearwolf/stage25';
import {createContext, ForwardedRef, forwardRef, useCallback, useContext, useEffect, useState} from 'react';
import {Camera, WebGLRenderer} from 'three';
import {StageRendererContext} from '../context/StageRenderer';
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
  noAutoRender?: boolean;
  defaultCamera?: boolean;
};

function Component(
  {scene, projection, renderPriority, noAutoClear, noAutoRender, defaultCamera, name, children, ...props}: Stage2DProps,
  ref: ForwardedRef<__Stage2D>,
) {
  const canvasSize = useThree((state) => state.size);
  const setThreeDefault = useThree((state) => state.set);

  const [stage, setStage] = useState<__Stage2D>(null);
  const scenePrimitive = (scene || stage?.scene) ?? null;

  const [initialScene] = useState(scene);
  const [initialProjection] = useState(projection);

  const [stageCamera, setStageCamera] = useState<Camera>(stage?.camera);

  const parentStage = useContext(Stage2DContext);
  const stageRenderer = useContext(StageRendererContext);

  useEffect(() => {
    if (stage && stageRenderer && name) {
      stageRenderer.addStage(name, stage);
      return () => stageRenderer.removeStage(name);
    }
  }, [stage, stageRenderer, name]);

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

    return parentStage?.on('resize', ({width, height}) => {
      stage.resize(width, height);
    });
  }, [stage, parentStage, canvasSize.width, canvasSize.height]);

  const renderFrame = useCallback(
    (renderer: WebGLRenderer) => {
      if (!noAutoRender && stage && !parentStage) {
        stage.autoClear = !noAutoClear;
        stage.renderFrame(renderer);
      }
    },
    [stage, parentStage, noAutoClear, noAutoRender],
  );

  useFrame(({gl}) => renderFrame(gl), renderPriority ?? 0);

  return (
    <stage2D args={[initialProjection, initialScene]} ref={mergeRefs(setStage, ref)} name={name} {...props}>
      <Stage2DContext.Provider value={stage}>
        {stage && scenePrimitive && <primitive object={scenePrimitive}>{children}</primitive>}
      </Stage2DContext.Provider>
    </stage2D>
  );
}

Component.displayName = 'Stage2D';

export const Stage2D = forwardRef<__Stage2D, Stage2DProps>(Component);
