import type {Camera} from 'three';
import type {Display} from './display/Display.js';
import type {DisplayEventArgs, ThreeRendererType} from './display/types.js';
import type {IStage} from './stage/IStage.js';
import type {StageRenderer} from './stage/StageRenderer.js';

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

export const OnStageAdded = 'stageAdded';
export const OnStageRemoved = 'stageRemoved';

export interface StageAddedProps {
  stage: IStage;
  renderer: StageRenderer;
}

export interface StageRemovedProps {
  stage: IStage;
  renderer: StageRenderer;
}

export interface IStageAdded {
  [OnStageAdded](props: StageAddedProps): void;
}

export interface IStageRemoved {
  [OnStageRemoved](props: StageRemovedProps): void;
}

// ------------------------------------------------------------

export const OnStageResize = 'stageResize';

export interface StageResizeProps {
  width: number;
  height: number;
  stage: IStage;
}

export interface IStageResize {
  [OnStageResize](props: StageResizeProps): void;
}

// ------------------------------------------------------------

export const OnStageUpdateFrame = 'stageUpdateFrame';
export const OnStageFirstFrame = 'stageFirstFrame';

export interface StageUpdateFrameProps {
  stage: IStage;
  now: number;
  deltaTime: number;
  frameNo: number;
}

export interface StageRenderFrameProps {
  stage: IStage;
  renderer: ThreeRendererType;
}

export interface IStageFirstFrame {
  [OnStageFirstFrame](props: StageUpdateFrameProps): void;
}

export interface IStageUpdateFrame {
  [OnStageUpdateFrame](props: StageUpdateFrameProps): void;
}

// ------------------------------------------------------------

export const OnStageAfterCameraChanged = 'stageAfterCameraChanged';

export type StageAfterCameraChangedArgs = [stage: IStage, prevCamera: Camera | undefined];

export interface IStageAfterCameraChanged {
  [OnStageAfterCameraChanged](...args: StageAfterCameraChangedArgs): void;
}

// ------------------------------------------------------------

export const OnRemoveFromParent = 'removeFromParent';

export interface IRemoveFromParent {
  [OnRemoveFromParent](): void;
}
