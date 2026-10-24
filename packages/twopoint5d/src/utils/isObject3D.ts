import type {Object3D} from 'three/webgpu';

/**
 * Whether `value` is a three.js `Object3D`, by its `isObject3D` flag — an object of another copy
 * of three counts as well. @internal
 */
export const isObject3D = (value: unknown): value is Object3D =>
  (value as {isObject3D?: unknown} | null | undefined)?.isObject3D === true;
