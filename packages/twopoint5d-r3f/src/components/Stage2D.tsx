import {createPortal, extend, ReactThreeFiber, useFrame, useThree} from '@react-three/fiber';
import {Stage2D as __Stage2D} from '@spearwolf/twopoint5d';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ForwardedRef,
  type ReactNode,
} from 'react';
import {Camera, WebGLRenderer} from 'three';
import {StageRendererContext} from '../context/StageRenderer.js';
import {mergeRefs} from '../utils/mergeRefs.js';

extend({Stage2D: __Stage2D});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      stage2D: ReactThreeFiber.Node<__Stage2D, typeof __Stage2D>;
    }
  }
}

export const Stage2DContext = createContext<__Stage2D | undefined>(undefined);
Stage2DContext.displayName = 'Stage2DContext';

export type Stage2DProps = JSX.IntrinsicElements['stage2D'] & {
  renderPriority?: number;
  noAutoClear?: boolean;
  noAutoRender?: boolean;
  defaultCamera?: boolean;
};

// - https://github.com/pmndrs/drei/blob/master/src/core/RenderTexture.tsx
// - https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/core/index.tsx#L389
// - https://docs.pmnd.rs/react-three-fiber/tutorials/v8-migration-guide#createportal-creates-a-state-enclave

// https://github.com/pmndrs/react-three-fiber/issues/92
const toManualControlled = <C extends Camera>(camera: C | undefined, manual = true): (C & {manual: boolean}) | undefined =>
  camera ? Object.assign(camera, {manual}) : undefined;

function Component(
  {
    scene: sceneFromProps,
    projection,
    renderPriority,
    noAutoClear,
    noAutoRender,
    defaultCamera,
    name,
    children,
    ...props
  }: Stage2DProps,
  ref: ForwardedRef<__Stage2D>,
) {
  const parentStage = useContext(Stage2DContext);
  const stageRenderer = useContext(StageRendererContext);

  const setThreeDefault = useThree((state) => state.set);
  const canvasSize = useThree((state) => state.size);

  const [initialScene] = useState(sceneFromProps);
  const [initialProjection] = useState(projection);

  const [stage, setStage] = useState<__Stage2D | null>(null);
  const scene = (sceneFromProps || stage?.scene) ?? null;

  const [stageCamera, setStageCamera] = useState<Camera | undefined>(toManualControlled(stage?.camera));

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
  // set stageCamera
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――

  useEffect(() => {
    if (stage?.camera) {
      setStageCamera(toManualControlled(stage.camera));
    }
    return stage?.on('afterCameraChanged', ({camera}) => setStageCamera(toManualControlled(camera)));
  }, [stage]);

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
  // set default camera
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――

  useEffect(() => {
    if (defaultCamera && stageCamera) {
      setThreeDefault({camera: stageCamera as any});
    }
  }, [stageCamera, defaultCamera, setThreeDefault]);

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
  // update stage size
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――

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

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
  // register at StageRenderer
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――

  useEffect(() => {
    if (stage && stageCamera && stageRenderer && name) {
      stageRenderer.register(name, stage);
      return () => stageRenderer.unregister(name);
    }
  }, [stage, stageRenderer, stageCamera, name]);

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
  // render view
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――

  return (
    <stage2D args={[initialProjection, initialScene]} ref={mergeRefs(setStage, ref)} name={name} {...props}>
      <Stage2DContext.Provider value={stage ?? undefined}>
        {stage &&
          scene &&
          createPortal(
            <StageContent
              stage={stage}
              camera={stageCamera}
              noAutoRender={noAutoRender}
              noAutoClear={noAutoClear}
              renderPriority={renderPriority}
            >
              {children}
            </StageContent>,
            scene,
            {
              // https://docs.pmnd.rs/react-three-fiber/api/hooks#usethree

              // TODO
              // - dynamic size changes? dpr?
              // - events/compute() -> raycasting?
              size: {width: stage.width, height: stage.height, top: 0, left: 0},
            },
          )}
      </Stage2DContext.Provider>
    </stage2D>
  );
}

Component.displayName = 'Stage2D';

export const Stage2D = forwardRef<__Stage2D, Stage2DProps>(Component);

function StageContent({
  children,
  stage,
  camera,
  noAutoRender,
  noAutoClear,
  renderPriority,
}: {
  children: ReactNode;
  stage: __Stage2D;
  camera?: Camera;
  noAutoRender?: boolean;
  noAutoClear?: boolean;
  renderPriority?: number;
}) {
  const setThreeDefault = useThree((state) => state.set);

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
  // set default (portal) camera
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――

  useLayoutEffect(() => {
    if (camera) {
      setThreeDefault({camera: camera as any});
    }
  }, [camera, setThreeDefault]);

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
  // if autoRender: render frame
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――

  const renderFrame = useCallback(
    (renderer: WebGLRenderer) => {
      if (stage) {
        stage.autoClear = !noAutoClear;
        stage.update();
        if (!noAutoRender) {
          stage.renderFrame(renderer, 0, 0, 0);
        }
      }
    },
    [stage, noAutoClear, noAutoRender],
  );

  useFrame(({gl}) => renderFrame(gl), renderPriority ?? 0);

  return <>{children}</>;
}
