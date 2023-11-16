import type {WebGLRenderer} from 'three';
import type {IStageRenderer, StageType} from './stage/IStageRenderer.js';

export const StageAdded = 'stageadded';

export interface StageAddedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

export const StageRemoved = 'stageremoved';

export interface StageRemovedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

export const StageRenderFrame = 'stagerenderframe';

export interface StageRenderFrameProps {
  width: number;
  height: number;
  renderer: WebGLRenderer;
  now: number;
  deltaTime: number;
  frameNo: number;
}

export interface StageRenderFrameEvent extends Event {
  detail?: StageRenderFrameProps;
}

export const UnsubscribeFromParent = 'unsubscribeFromParent';
