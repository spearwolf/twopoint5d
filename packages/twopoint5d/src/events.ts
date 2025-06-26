import type {Camera} from 'three';
import type {Display} from './display/Display.js';
import type {DisplayEventProps, DisplayRendererType} from './display/types.js';
import type {IStage} from './stage/IStage.js';
import type {StageRenderer} from './stage/StageRenderer.js';

// ------------------------------------------------------------

export const OnDisplayResize = 'resize';
export const OnDisplayRenderFrame = 'renderFrame';

export const OnDisplayInit = 'init';
export const OnDisplayStart = 'start';
export const OnDisplayRestart = 'restart';
export const OnDisplayPause = 'pause';
export const OnDisplayDispose = 'dispose';

export interface IOnDisplayResize {
  [OnDisplayResize](props: DisplayEventProps): void;
}

export interface IOnDisplayRenderFrame {
  [OnDisplayRenderFrame](props: DisplayEventProps): void;
}

export interface IOnDisplayInit {
  [OnDisplayInit](props: DisplayEventProps): void;
}

export interface IOnDisplayStart {
  [OnDisplayStart](props: DisplayEventProps): void;
}

export interface IOnDisplayRestart {
  [OnDisplayRestart](props: DisplayEventProps): void;
}

export interface IOnDisplayPause {
  [OnDisplayPause](props: DisplayEventProps): void;
}

export interface IOnDisplayDispose {
  [OnDisplayDispose](display: Display): void;
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
  renderer: DisplayRendererType;
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
