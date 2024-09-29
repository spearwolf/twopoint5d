import type {Display, DisplayEventArgs} from '@spearwolf/twopoint5d';
import type {
  FirstFrame,
  FirstFrameProps,
  Stage2DRenderFrameProps,
  Stage2DResizeProps,
  StageRenderFrame,
  StageRenderFrameProps,
  StageResize,
  StageResizeProps,
} from '@spearwolf/twopoint5d/events.js';
import type {DisplayElement} from './components/DisplayElement.js';

export interface StageResizeEvent extends Event {
  detail: StageResizeProps;
}

export interface Stage2DResizeEvent extends Event {
  detail: Stage2DResizeProps;
}

export interface StageRenderFrameEvent extends Event {
  detail: StageRenderFrameProps;
}

export interface Stage2DRenderFrameEvent extends Event {
  detail: Stage2DRenderFrameProps;
}

export interface FirstFrameEvent extends Event {
  detail: FirstFrameProps;
}

export interface DisplayEventDetail extends DisplayEventArgs {
  displayElement: DisplayElement;
}

export interface DisplayStartEvent extends Event {
  detail: DisplayEventDetail;
}

export interface DisplayResizeEvent extends Event {
  detail: DisplayEventDetail;
}

export interface DisplayPauseEvent extends Event {
  detail: DisplayEventDetail;
}

export interface DisplayRestartEvent extends Event {
  detail: DisplayEventDetail;
}

export interface DisplayDisposeEventDetail {
  display: Display;
  displayElement: DisplayElement;
}

export interface DisplayDisposeEvent extends Event {
  detail: DisplayDisposeEventDetail;
}

// https://github.com/microsoft/TypeScript/issues/28357#issuecomment-748550734
// https://github.com/microsoft/TypeScript/issues/28357#issuecomment-789392956

declare global {
  interface GlobalEventHandlersEventMap {
    [StageResize]: StageResizeEvent;
    [StageRenderFrame]: StageRenderFrameEvent;

    [FirstFrame]: FirstFrameEvent;

    displayStart: DisplayStartEvent;
    displayResize: DisplayResizeEvent;
    displayPause: DisplayPauseEvent;
    displayRestart: DisplayRestartEvent;
    displayDispose: DisplayDisposeEvent;
  }
}
