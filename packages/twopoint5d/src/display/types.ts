import type {WebGPURenderer} from 'three/webgpu';
import type {AdaptiveResolutionOptions} from './AdaptiveResolution.js';
import type {Display} from './Display.js';
import type {DisplayFullscreen} from './DisplayFullscreen.js';

export interface DisplayEventProps {
  display: Display;
  renderer: WebGPURenderer;
  width: number;
  height: number;
  pixelRatio: number;
  now: number;
  /**
   * The seconds since the previous frame, the pauses of the display not counted, at most
   * {@link Display.maxDeltaTime} while that is above 0. `0` in a frame the display renders during
   * its pause, see {@link Display.renderFrame}.
   */
  deltaTime: number;
  /**
   * The same as {@link DisplayEventProps.deltaTime}, before {@link Display.maxDeltaTime} cuts it:
   * the wall-clock time between the frames without the pauses of the display.
   * `FixedFrameLoop` runs on it. `0` in a frame the display renders during its pause, see
   * {@link Display.renderFrame}.
   */
  rawDeltaTime: number;
  frameNo: number;
}

/** How a {@link DisplayFullscreen} is in fullscreen: the browser's own, or a box of CSS over the page. */
export type FullscreenMode = 'native' | 'pseudo';

// the values of `screen.orientation.lock()`, spelled out here: the DOM lib of TypeScript carries
// neither `lock()` nor its type
export type DisplayOrientationLock =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

export interface DisplayFullscreenOptions {
  /**
   * The element that goes fullscreen. Without it: the host element of a display that built its
   * own container, else the parent element of the canvas at the time of the request, else the
   * canvas.
   */
  element?: HTMLElement;
  /** Passed to `requestFullscreen()`. Default `'hide'`: a game wants the navigation bar gone. */
  navigationUI?: 'auto' | 'hide' | 'show';
  /** Locks the screen once native fullscreen is entered. Default: no lock. */
  orientationLock?: DisplayOrientationLock;
  /** `'pseudo'` covers the viewport through CSS where native fullscreen is not available. Default `false`. */
  fallback?: 'pseudo' | false;
  /** Enter fullscreen when the screen turns to landscape. Default `false`. */
  onLandscape?: boolean;
  /**
   * Leave a fullscreen that `onLandscape` entered when the screen turns back to portrait.
   * Default `true`, or `false` while `orientationLock` is a landscape type.
   */
  exitOnPortrait?: boolean;
}

/** The props of `OnDisplayFullscreenChange`. */
export interface DisplayFullscreenChangeProps {
  display: Display;
  isActive: boolean;
  mode: FullscreenMode | undefined;
  /** `onLandscape` waits for a tap to enter fullscreen. */
  isArmed: boolean;
  /** The element in fullscreen, or the target of the next request while not active. */
  element: HTMLElement;
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
   * Without it, with 0, or with anything but a positive finite number, the display draws as many
   * frames as the page gives it.
   */
  maxFps?: number;

  /**
   * The upper bound of the pixel ratio the display draws at, see {@link Display.maxPixelRatio}.
   * Without it the bound is {@link Display.DefaultMaxPixelRatio}, `2`. With `0`, or anything else
   * but a positive finite number, the display draws at the `devicePixelRatio` of the window of
   * its canvas.
   */
  maxPixelRatio?: number;

  /**
   * The budget of pixels of the drawing buffer, see {@link Display.maxPixels}. Without it, or with
   * anything but a positive finite number, there is no budget.
   */
  maxPixels?: number;

  /**
   * Hold the frame rate by the resolution: with `true`, or with options of its own, the display
   * builds an {@link AdaptiveResolution} that sets {@link Display.resolutionScale} by the cost of
   * every frame — down an eighth where a frame costs more than the target allows, up where there
   * is room. The target is 60 frames per second, or `maxFps` where that is lower.
   *
   * A display that builds its renderer asks it for `trackTimestamp: true`, so the controller reads
   * the GPU time of a frame; a renderer handed in, or one without timestamp queries, leaves it the
   * pace of the frames. A renderer the display built with `trackTimestamp: true` measures
   * timestamps for its whole life, while the controller holds still, is disabled or disposed as
   * well; `trackTimestamp: false` beside this option builds it without them, and the controller
   * reads the pace of the frames. Off by default. Read once, by the constructor; the controller is
   * {@link Display.adaptiveResolution} until it is disposed.
   */
  adaptiveResolution?: boolean | AdaptiveResolutionOptions;

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
   * {@link Display.resize} and returns the size of the display: width and height in CSS pixels.
   * No observer sees what it answers, so with it the display measures in every frame, unless
   * {@link Display.resizePollIntervalMs} spaces the measurements out.
   *
   * With it, the display measures no element. What happens while the function reports no
   * size is described at {@link ResizeDisplayToFn}.
   */
  resizeTo?: ResizeDisplayToFn;

  /**
   * If an HTML element is specified here, the size of this element is determined
   * with every measurement of {@link Display.resize} and the display is synchronized
   * accordingly (only the size, not the position). The display observes the element and
   * measures it in the frame after it reports a change — see the resize model of
   * {@link Display}.
   */
  resizeToElement?: HTMLElement;

  /**
   * In every frame and with every {@link Display.resize}, this HTML element is queried for a
   * `resize-to` attribute and read out. If nothing is specified, then this is the canvas element.
   *
   * The `resize-to` attribute can contain `"window"` as a value, or alternatively `"self"`.
   * With `"self"`, the display measures its `resizeToElement` — by default the canvas, or the
   * host element when the display built its own container — just as it does without the
   * attribute; with `resizeToElement` cleared, it measures the canvas. With `"window"`, the
   * display element is synchronized with the size of the window of the canvas accordingly. Any
   * other value is a CSS selector, looked up in the document or in the shadow root this element
   * sits in. `"fullscreen"` is a deprecated alias of `"window"` and warns once per page; the
   * fullscreen of the browser is {@link Display.fullscreen}.
   */
  resizeToAttributeEl?: HTMLElement;

  /**
   * The root the display installs its few CSS rules in. Default is the `head` of the document the
   * canvas sits in, which stands for that document.
   *
   * The rules live in a stylesheet the document or the shadow root has adopted. A display whose
   * canvas sits in a shadow root names that root here; the root may be handed in before its host
   * is in the document. An element stands for the document or shadow root it sits in.
   *
   * {@link Display.styleSheetRoot} changes the root later.
   */
  styleSheetRoot?: HTMLElement | ShadowRoot;

  /**
   * The options of {@link Display.fullscreen}: the target, fullscreen on landscape, the lock of
   * the orientation, the pseudo fallback. Read once, by the constructor; the controller takes
   * changes afterwards.
   */
  fullscreen?: DisplayFullscreenOptions;

  /**
   * By default, a `THREE.WebGPURenderer` is created for you.
   * But you can create your own renderer instance using this callback.
   *
   * @returns The return value here is expected to be a `THREE.WebGPURenderer` instance.
   */
  createRenderer?: (params: CreateRendererParameters) => WebGPURenderer;
}
