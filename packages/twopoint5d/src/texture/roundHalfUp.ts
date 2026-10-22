import {add, floor} from 'three/tsl';
import type {Node} from 'three/webgpu';

/**
 * @internal `x` rounded to the nearest whole number, a half up: `floor(x + 0.5)`. TSL's `round()`
 * is WGSL's on WebGPU, which takes a half to the even neighbour, and GLSL's on WebGL 2, which leaves
 * the direction of a half to the driver — an index of 2.5 would pick frame 2 on one and 3 on the other.
 */
export const roundHalfUp = (x: Node<'float'>): Node<'float'> => floor(add(x, 0.5));
