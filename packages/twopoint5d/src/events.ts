import type {Camera, Scene} from 'three';
import type {Display} from './display/Display.js';
import type {DisplayEventArgs, ThreeRendererType} from './display/types.js';
import type {IStage} from './stage/IStage.js';
import type {IStageRenderer, StageType} from './stage/IStageRenderer.js';
import type {Stage2D} from './stage/Stage2D.js';

// ------------------------------------------------------------

export const OnResize = 'resize';

export interface OnResizeProps {
  renderer: ThreeRendererType;

  width: number;
  height: number;
  pixelRatio: number;

  now: number;
  deltaTime: number;
  frameNo: number;
}

export interface IOnResize {
  [OnResize](props: OnResizeProps): void;
}

// ------------------------------------------------------------

export const OnRenderFrame = 'renderFrame';

export interface OnRenderFrameProps {
  renderer: ThreeRendererType;

  now: number;
  deltaTime: number;
  frameNo: number;
}

export interface IOnRenderFrame {
  [OnRenderFrame](props: OnRenderFrameProps): void;
}

// ------------------------------------------------------------

export const OnInitDisplay = 'init';
export const OnStartDisplay = 'start';
export const OnRestartDisplay = 'restart';
export const OnPauseDisplay = 'pause';
export const OnDisposeDisplay = 'dispose';

export interface IOnInitDisplay {
  [OnInitDisplay](props: DisplayEventArgs): void;
}

export interface IOnStartDisplay {
  [OnStartDisplay](props: DisplayEventArgs): void;
}

export interface IOnRestartDisplay {
  [OnRestartDisplay](props: DisplayEventArgs): void;
}

export interface IOnPauseDisplay {
  [OnPauseDisplay](props: DisplayEventArgs): void;
}

export interface IOnDisposeDisplay {
  [OnDisposeDisplay](display: Display): void;
}

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
