import type {WebGPURenderer} from 'three/webgpu';
import type {Display} from './Display.js';

export interface DisplayEventProps {
  display: Display;
  renderer: WebGPURenderer;
  width: number;
  height: number;
  pixelRatio: number;
  now: number;
  deltaTime: number;
  frameNo: number;
}

export type ResizeDisplayToFn = (display: Display) => [width: number, height: number];

// The renderer's constructor parameter is optional, so `ConstructorParameters<…>[0]` is a union
// with `undefined`; `keyof` of such a union is `never` and `Omit` would leave an empty type behind.
// `NonNullable` unwraps it, which is what makes the renderer options visible here at all.
export type DisplayRendererParameters = Partial<Omit<NonNullable<ConstructorParameters<typeof WebGPURenderer>[0]>, 'canvas'>>;

export interface CreateRendererParameters extends DisplayRendererParameters {
  canvas: HTMLCanvasElement;
}

export interface DisplayParameters extends DisplayRendererParameters {
  /**
   * Limit the maximum number of frames per second.
   *
   * If the display supports fewer frames than specified here,
   * only as many frames as the display supports will be rendered.
   *
   * If nothing or 0 is specified here, the maximum possible FPS are used.
   */
  maxFps?: number;

  /**
   * Pause the display while its canvas is outside the viewport, and let it run again once
   * the canvas is back in view — watched through an `IntersectionObserver` on the canvas.
   * Leaving and coming back emit `OnDisplayPause`, then `OnDisplayRestart` and
   * `OnDisplayStart`, as a hidden tab does.
   *
   * The observer reports asynchronously, never synchronously within the constructor. Where
   * the canvas starts out of view, it depends on when the first report lands: one that lands
   * before the display starts — often while `start()` still waits for the renderer — lets
   * `start()` go straight into the pause with `OnDisplayPause`, as with a hidden tab, and
   * `OnDisplayInit` and `OnDisplayStart` follow once the canvas comes into view. One that
   * lands after the start lets the display start first and pauses it with that report.
   *
   * Off by default. Read once, by the constructor. Where `IntersectionObserver` does not
   * exist, the option does nothing.
   */
  pauseOutsideViewport?: boolean;

  /**
   * If a function is specified here, it is called for each frame
   * and expects the dimension (width and height) to be used for the display as the return value.
   *
   * In this case, no further attempt is made to automatically determine a size.
   */
  resizeTo?: ResizeDisplayToFn;

  /**
   * If an HTML element is specified here, the size of this element is determined
   * at the beginning of each frame and the display is synchronized accordingly
   * (only the size, not the position).
   */
  resizeToElement?: HTMLElement;

  /**
   * At the beginning of each frame, this HTML element is queried for a `resize-to` attribute
   * and read out. If nothing is specified, then this is the canvas element.
   *
   * The `resize-to` attribute can contain either `"fullscreen"` or `"window"` as a value,
   * or alternatively `"self"`. With `"self"`, the size of the canvas element is used as
   * the display size (this corresponds to the standard behavior if nothing is specified).
   * With `"fullscreen"` or `"window"`, the display element is synchronized with the
   * window size accordingly. Any other value is a CSS selector, looked up in the document or
   * in the shadow root this element sits in.
   */
  resizeToAttributeEl?: HTMLElement;

  /**
   * The display creates a few CSS style rules that it wants to use itself.
   * Here you can specify WHERE the styles are installed.
   *
   * Normally, this is the main document in the browser window and you do not
   * need to specify anything here.
   *
   * However, if the display is used within a shadow DOM, this is the option
   * to install the styles only in this shadow root.
   */
  styleSheetRoot?: HTMLElement | ShadowRoot;

  /**
   * By default, a `THREE.WebGPURenderer` is created for you.
   * But you can create your own renderer instance using this callback.
   *
   * @returns The return value here is expected to be a `THREE.WebGPURenderer` instance.
   */
  createRenderer?: (params: CreateRendererParameters) => WebGPURenderer;
}
