import type {WebGLRenderer} from 'three';

export const isWebGLRenderer = (renderer: object | null | undefined): renderer is WebGLRenderer =>
  (renderer as {isWebGLRenderer?: boolean})?.isWebGLRenderer === true;
