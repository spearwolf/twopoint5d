import type {Stage2D} from '@spearwolf/twopoint5d';
import type {WebGLRenderer} from 'three';
import type {IStageRenderer, StageType} from './twopoint5d/IStageRenderer.js';

/**
 * published by the SimpleStageRenderer
 */
export const StageAdded = 'stageadded';

export interface StageAddedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

/**
 * published by the SimpleStageRenderer
 */
export const StageRemoved = 'stageremoved';

export interface StageRemovedProps {
  stage: StageType;
  renderer: IStageRenderer;
}

/**
 * published by the <two5-stage2d> element as object event and customevent
 */
export const StageResize = 'stageresize';

export interface StageResizeProps {
  name?: string;
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
  stage?: Stage2D;
}

export interface StageResizeEvent extends Event {
  detail?: StageResizeProps;
}

/**
 * published by the <two5-stage2d> element as object event and customevent
 */
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

/**
 * published by the <two5-stage2d> element as object event and promise
 */
export const StageFirstFrame = 'stagefirstframe';

export interface StageFirstFrameProps extends StageRenderFrameProps {
  stage: Stage2D;
}

// https://github.com/microsoft/TypeScript/issues/28357#issuecomment-748550734
// https://github.com/microsoft/TypeScript/issues/28357#issuecomment-789392956

declare global {
  interface GlobalEventHandlersEventMap {
    [StageResize]: StageResizeEvent;
    [StageRenderFrame]: StageRenderFrameEvent;
  }
}
