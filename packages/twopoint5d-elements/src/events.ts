import type {Stage2D} from '@spearwolf/twopoint5d';
import type {StageRenderFrame, StageRenderFrameProps} from '@spearwolf/twopoint5d/events.js';

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
