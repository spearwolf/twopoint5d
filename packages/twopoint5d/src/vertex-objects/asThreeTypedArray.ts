import type {TypedArray as ThreeTypedArray} from 'three/webgpu';
import type {TypedArray} from './types.js';

/**
 * three keeps its own union of typed arrays, and `Float16Array` is not in it
 * (`@types/three@0.183.1`, `src/core/BufferAttribute.d.ts`). Both the WebGPU and the
 * WebGL attribute utilities do recognise one at runtime, so the gap sits in the types
 * alone. This is where a pool buffer crosses over into three, and crossing it is all
 * this function does.
 */
export const asThreeTypedArray = (array: TypedArray): ThreeTypedArray => array as ThreeTypedArray;
