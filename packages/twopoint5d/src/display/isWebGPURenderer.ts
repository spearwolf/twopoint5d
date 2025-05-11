import type {WebGPURenderer} from 'three/webgpu';

export const isWebGPURenderer = (renderer: object | null | undefined): renderer is WebGPURenderer =>
  (renderer as WebGPURenderer)?.isWebGPURenderer === true;
