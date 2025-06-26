import type {WebGLRenderer, WebGLRendererParameters} from 'three';
import type {WebGPURenderer} from 'three/webgpu';
import type {Display} from './Display.js';

export type DisplayRendererType = WebGLRenderer | WebGPURenderer;

export interface DisplayEventProps {
  display: Display;
  renderer: DisplayRendererType;
  width: number;
  height: number;
  pixelRatio: number;
  now: number;
  deltaTime: number;
  frameNo: number;
}

export type ResizeDisplayToFn = (display: Display) => [width: number, height: number];

export type DisplayRendererParameters =
  | ({webgpu?: false} & Partial<Omit<WebGLRendererParameters, 'canvas'>>)
  | ({webgpu: true} & Partial<Omit<ConstructorParameters<typeof WebGPURenderer>, 'canvas'>>);

export type CreateRendererParameters = DisplayRendererParameters & {canvas: HTMLCanvasElement};

export type DisplayParameters = DisplayRendererParameters & {
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
   * window size accordingly.
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
   * Automatic creation of a `THREE.WebGPURenderer` instance is currently not supported.
   * By default, a `THREE.WebGLRenderer` is created. As an alternative, you can create your own renderer instance using this callback.
   *
   * @returns The return value here is expected to be a `THREE.WebGLRenderer` or `THREE.WebGPURenderer` instance.
   */
  createRenderer?: (params: CreateRendererParameters) => DisplayRendererType;
};
