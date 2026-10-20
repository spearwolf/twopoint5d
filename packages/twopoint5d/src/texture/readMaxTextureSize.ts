import type {WebGPURenderer} from 'three/webgpu';
import {isObject} from '../utils/isObject.js';

/** Whether `value` is a whole number of 1 or more — a size of a texture. @internal */
export const isTextureSize = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1;

/**
 * The limit of the device behind `renderer`, or `undefined` when it names none. `@types/three`
 * types `renderer.backend` as a plain `Backend`, so the device is read through `unknown`: the
 * `device` of a WebGPU backend — `null` until `init()` has run — or the `gl` context of the WebGL2
 * fallback. An optional limit must not stop a bake, so a renderer that throws on the way names none.
 *
 * @internal
 */
export const readMaxTextureSize = (renderer: WebGPURenderer): number | undefined => {
  try {
    const backend: unknown = renderer.backend;
    if (!isObject(backend)) return undefined;
    const {device, gl} = backend;
    let limit: unknown;
    if (isObject(device)) {
      const {limits} = device;
      limit = isObject(limits) ? limits['maxTextureDimension2D'] : undefined;
    } else if (isObject(gl)) {
      const {getParameter, MAX_TEXTURE_SIZE} = gl;
      limit = typeof getParameter === 'function' ? getParameter.call(gl, MAX_TEXTURE_SIZE) : undefined;
    }
    return isTextureSize(limit) ? limit : undefined;
  } catch {
    return undefined;
  }
};
