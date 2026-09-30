import type {Camera, Scene} from 'three/webgpu';
import type {PanControl2D} from './controls/PanControl2D.js';
import type {Display} from './display/Display.js';
import type {DisplayEventProps} from './display/types.js';
import type {Canvas2DStage} from './stage/Canvas2DStage.js';
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
export const OnDisplayError = 'error';

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

export interface IOnDisplayError {
  [OnDisplayError](error: unknown, display: Display): void;
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

/**
 * A `Stage2D` hands every `OnStageUpdateFrame` of its frames the same object, rewritten before
 * each emit: the values hold for the call they arrive in, and whoever needs one of them later
 * copies it. The props of `OnStageFirstFrame` are an object of their own, which the stage keeps
 * for a subscriber that comes after the first frame.
 */
export interface StageUpdateFrameProps {
  stage: IStage;
  now: number;
  deltaTime: number;
  frameNo: number;
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

export const OnStageAfterSceneChanged = 'stageAfterSceneChanged';

export type StageAfterSceneChangedArgs = [stage: IStage, prevScene: Scene];

export interface IStageAfterSceneChanged {
  [OnStageAfterSceneChanged](...args: StageAfterSceneChangedArgs): void;
}

// ------------------------------------------------------------

/**
 * Emitted once by `dispose()` of a `Stage2D` and of a `StageRenderer`, with the stage itself,
 * before the stage stops listening. A `StageRenderer` listens for it on every eventized stage it
 * holds and takes that stage out; a stage of your own that emits it from its `dispose()` gets the
 * same treatment.
 */
export const OnStageDispose = 'dispose';

export interface IStageDispose {
  [OnStageDispose](stage: IStage): void;
}

// ------------------------------------------------------------

export const OnAddToParent = 'addToParent';
export const OnRemoveFromParent = 'removeFromParent';

export interface IAddToParent {
  [OnAddToParent](): void;
}

export interface IRemoveFromParent {
  [OnRemoveFromParent](): void;
}

// ------------------------------------------------------------

/**
 * Emitted by `Canvas2DStage#render()`, with the stage, when the canvas has another size than at
 * the previous `render()`; the first `render()` counts as a change.
 */
export const OnCanvas2DStageResize = 'resize';
/**
 * Emitted by every `Canvas2DStage#render()`, with the stage, before the canvas is uploaded: the
 * moment to draw into the canvas and set `needsUpdate`.
 */
export const OnCanvas2DStageRender = 'render';
/** Emitted once by `Canvas2DStage#dispose()`, with the stage, before it stops listening. */
export const OnCanvas2DStageDispose = 'dispose';

export interface ICanvas2DStageResize {
  [OnCanvas2DStageResize](stage: Canvas2DStage): void;
}

export interface ICanvas2DStageRender {
  [OnCanvas2DStageRender](stage: Canvas2DStage): void;
}

export interface ICanvas2DStageDispose {
  [OnCanvas2DStageDispose](stage: Canvas2DStage): void;
}

// ------------------------------------------------------------

/**
 * Emitted by `PanControl2D#update()` when the call moved the view, and on the first call
 * after a state was assigned to `panView`, whether it moved or not. A disposed control
 * emits it no more.
 */
export const OnPanControl2DUpdate = 'update';
/**
 * Emitted by `PanControl2D`, with the control, when a mouse drag with the pan button starts to move
 * and the control hides the cursor.
 */
export const OnPanControl2DHideCursor = 'hideCursor';
/**
 * Emitted by `PanControl2D`, with the control, when a cursor it hid comes back — the pan button
 * goes up, the browser cancels the pointer, the pointer is switched off, the control unsubscribes
 * or is disposed. A cursor it never hid is not reported.
 */
export const OnPanControl2DRestoreCursor = 'restoreCursor';

/** Where `PanControl2D#update()` moved the view to: a new object for every event, the listener may keep it. */
export interface PanControl2DUpdateProps {
  x: number;
  y: number;
}

export interface IPanControl2DUpdate {
  [OnPanControl2DUpdate](props: PanControl2DUpdateProps): void;
}

export interface IPanControl2DHideCursor {
  [OnPanControl2DHideCursor](control: PanControl2D): void;
}

export interface IPanControl2DRestoreCursor {
  [OnPanControl2DRestoreCursor](control: PanControl2D): void;
}
