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

/**
 * Supplies the size of a display in CSS pixels, once per measurement of
 * {@link Display.resize}. Return `undefined` while there is no size to report — an element that
 * has not been laid out yet, for example. A pair in which either value is not a finite number
 * counts as no size as well. Without a size the display takes the window under
 * `resize-to="window"` or `"fullscreen"`, and 300 × 150 otherwise.
 */
export type ResizeDisplayToFn = (display: Display) => [width: number, height: number] | undefined;

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
   * If a function is specified here, it is called with every measurement of
   * {@link Display.resize} (every frame, unless {@link Display.resizePollIntervalMs} spaces them
   * out) and returns the size of the display: width and height in CSS pixels.
   *
   * With it, the display measures no element. What happens while the function reports no
   * size is described at {@link ResizeDisplayToFn}.
   */
  resizeTo?: ResizeDisplayToFn;

  /**
   * If an HTML element is specified here, the size of this element is determined
   * with every measurement of {@link Display.resize} (every frame, unless
   * {@link Display.resizePollIntervalMs} spaces them out) and the display is synchronized
   * accordingly (only the size, not the position).
   */
  resizeToElement?: HTMLElement;

  /**
   * With every measurement of {@link Display.resize} (every frame, unless
   * {@link Display.resizePollIntervalMs} spaces them out), this HTML element is queried for a
   * `resize-to` attribute and read out. If nothing is specified, then this is the canvas element.
   *
   * The `resize-to` attribute can contain either `"fullscreen"` or `"window"` as a value,
   * or alternatively `"self"`. With `"self"`, the display measures its `resizeToElement` — by
   * default the canvas, or the host element when the display built its own container — just
   * as it does without the attribute; with `resizeToElement` cleared, it measures the canvas.
   * With `"fullscreen"` or `"window"`, the display element is synchronized with the
   * window size accordingly. Any other value is a CSS selector, looked up in the document or
   * in the shadow root this element sits in.
   */
  resizeToAttributeEl?: HTMLElement;

  /**
   * The root the display installs its few CSS rules in. Default is `document.head`, which stands
   * for the document.
   *
   * The rules live in a stylesheet the document or the shadow root has adopted. A display whose
   * canvas sits in a shadow root names that root here; the root may be handed in before its host
   * is in the document. An element stands for the document or shadow root it sits in.
   *
   * {@link Display.styleSheetRoot} changes the root later.
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
