import type {WebGLRenderer, WebGLRendererParameters} from 'three';
import type {WebGPURenderer} from 'three/webgpu';
import type {Display} from './Display.js';

export type ThreeRendererType = WebGLRenderer | WebGPURenderer;

export interface DisplayEventArgs {
  display: Display;
  renderer: ThreeRendererType;
  width: number;
  height: number;
  pixelRatio: number;
  now: number;
  deltaTime: number;
  frameNo: number;
}

export type ResizeToCallbackFn = (display: Display) => [width: number, height: number];

type RendererParameters =
  | (Partial<Omit<WebGLRendererParameters, 'canvas'>> & {webgpu?: false})
  | {
      webgpu: true;
      forceWebGL?: boolean;
      logarithmicDepthBuffer?: boolean | undefined;
      alpha?: boolean | undefined;
      depth?: boolean | undefined;
      stencil?: boolean | undefined;
      antialias?: boolean | undefined;
      samples?: number | undefined;
    };

export type DisplayParameters = RendererParameters & {
  resizeTo?: ResizeToCallbackFn;
  resizeToElement?: HTMLElement;
  resizeToAttributeEl?: HTMLElement;
  styleSheetRoot?: HTMLElement | ShadowRoot;
};
