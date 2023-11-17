import type {
  Stage2DRenderFrameProps,
  Stage2DResizeProps,
  StageRenderFrame,
  StageRenderFrameProps,
  StageResize,
  StageResizeProps,
} from '@spearwolf/twopoint5d/events.js';
import type {Scene} from 'three';

export interface StageResizeEvent extends Event {
  detail?: StageResizeProps;
}

export interface Stage2DResizeEvent extends Event {
  detail?: Stage2DResizeProps;
}

export interface StageRenderFrameEvent extends Event {
  detail?: StageRenderFrameProps;
}

export interface Stage2DRenderFrameEvent extends Event {
  detail?: Stage2DRenderFrameProps;
}

/**
 * published by the <two5-stage2d> element as object event and promise
 */
export const StageFirstFrame = 'stageFirstFrame';

export interface StageFirstFrameProps extends StageRenderFrameProps {
  scene: Scene;
}

// https://github.com/microsoft/TypeScript/issues/28357#issuecomment-748550734
// https://github.com/microsoft/TypeScript/issues/28357#issuecomment-789392956

declare global {
  interface GlobalEventHandlersEventMap {
    [StageResize]: StageResizeEvent;
    [StageRenderFrame]: StageRenderFrameEvent;
  }
}
