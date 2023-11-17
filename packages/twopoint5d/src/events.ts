import type {Scene, WebGLRenderer} from 'three';
import type {IStage} from './index.js';
import type {IStageRenderer, StageType} from './stage/IStageRenderer.js';
import type {Stage2D} from './stage/Stage2D.js';

// ------------------------------------------------------------

export const StageAdded = 'stageAdded';

export interface StageAddedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

// ============================================================

export const StageRemoved = 'stageRemoved';

export interface StageRemovedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

// ============================================================

export const StageResize = 'stageResize';

export interface StageResizeProps {
  width: number;
  height: number;
  stage: IStage;
}

export interface Stage2DResizeProps extends StageResizeProps {
  width: number;
  height: number;
  stage: Stage2D;
}

// ============================================================

export const StageRenderFrame = 'stageRenderFrame';

export interface StageRenderFrameProps {
  width: number;
  height: number;
  renderer: WebGLRenderer;
  now: number;
  deltaTime: number;
  frameNo: number;

  /**
   * You do not need to call this callback yourself. It's normally done after the event.
   * However, you can use this callback to control when the THREE.WebGLRenderer is called.
   */
  renderFrame: () => void;
}

export interface Stage2DRenderFrameProps extends StageRenderFrameProps {
  stage: Stage2D;
}

// ============================================================

export const StageAfterCameraChanged = 'stageAfterCameraChanged';

export type StageAfterCameraChangedArgs = [stage: StageType, prevCamera: THREE.Camera | undefined];

// ============================================================

export const RemoveFromParent = 'removeFromParent';

// ============================================================

export const FirstFrame = 'firstFrame';

export interface FirstFrameProps extends StageRenderFrameProps {
  scene: Scene;
}

// ------------------------------------------------------------
