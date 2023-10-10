import {WebGLRenderer, WebGLRendererParameters} from 'three';

import type {Display} from './Display.js';

export interface DisplayEventArgs {
  display: Display;
  renderer: WebGLRenderer;
  width: number;
  height: number;
  now: number;
  deltaTime: number;
  frameNo: number;
}

export type ResizeCallback = (display: Display) => [width: number, height: number];

export type DisplayParameters = Partial<Omit<WebGLRendererParameters, 'canvas'>> & {
  resizeTo?: ResizeCallback;
};
