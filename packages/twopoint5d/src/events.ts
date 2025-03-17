import type {Camera, Scene} from 'three';
import type {ThreeRendererType, IStage} from './index.js';
import type {IStageRenderer, StageType} from './stage/IStageRenderer.js';
import type {Stage2D} from './stage/Stage2D.js';

// ------------------------------------------------------------

export const StageAdded = 'stageAdded';

export interface StageAddedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

export interface IStageAdded {
  stageAdded(props: StageAddedProps): void;
}

// ============================================================

export const StageRemoved = 'stageRemoved';

export interface StageRemovedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

export interface IStageRemoved {
  stageRemoved(props: StageRemovedProps): void;
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

export interface IStageResize {
  stageResize(props: StageResizeProps): void;
}

export interface IStage2DResize {
  stageResize(props: Stage2DResizeProps): void;
}

// ============================================================

export const StageRenderFrame = 'stageRenderFrame';

export interface StageRenderFrameProps {
  width: number;
  height: number;
  renderer: ThreeRendererType;
  now: number;
  deltaTime: number;
  frameNo: number;

  /**
   * You do not need to call this callback yourself. It's normally done after the event.
   * However, you can use this callback to control when the three renderer is called.
   */
  renderFrame: () => void;
}

export interface Stage2DRenderFrameProps extends StageRenderFrameProps {
  stage: Stage2D;
}

export interface IStageRenderFrame {
  stageRenderFrame(props: StageRenderFrameProps): void;
}

export interface IStage2DRenderFrame {
  stageRenderFrame(props: Stage2DRenderFrameProps): void;
}

// ============================================================

export const StageAfterCameraChanged = 'stageAfterCameraChanged';

export type StageAfterCameraChangedArgs = [stage: StageType, prevCamera: Camera | undefined];

export interface IStageAfterCameraChanged {
  stageAfterCameraChanged(...args: StageAfterCameraChangedArgs): void;
}

// ============================================================

export const RemoveFromParent = 'removeFromParent';

export interface IRemoveFromParent {
  removeFromParent(): void;
}

// ============================================================

export const FirstFrame = 'firstFrame';

export interface FirstFrameProps extends StageRenderFrameProps {
  scene: Scene;
}

export interface IFirstFrame {
  firstFrame(props: FirstFrameProps): void;
}

// ------------------------------------------------------------
