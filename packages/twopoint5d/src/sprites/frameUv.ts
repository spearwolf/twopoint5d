import {add, mul, select, varying, vec2} from 'three/tsl';
import type {Node} from 'three/webgpu';

/**
 * The coordinates a frame is sampled at: at the quad position `uv = (a, b)` it reads
 * `(s + a·u, t + b·v)`, with `s`, `t`, `u` and `v` out of `texCoords`, and with a `flipDiagonal`
 * above 0.5 it swaps the two components — the lookup `TextureCoords` describes for a frame with
 * `FLIP_DIAGONAL`. Passed to the fragment stage through a varying.
 *
 * @internal
 */
export const frameUv = (texCoords: Node<'vec4'>, uv: Node<'vec2'>, flipDiagonal?: Node<'float'>) => {
  const st = vec2(add(texCoords.xy, mul(uv.xy, texCoords.zw)));
  // the flip is the same for every vertex of an instance, so swapping before the interpolation is
  // the same as swapping after it
  return varying(flipDiagonal ? select(flipDiagonal.greaterThan(0.5), st.yx, st) : st);
};
