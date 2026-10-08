import {div, dot, length, mul, sub} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {defineFeature, MeshOrder} from '../SpriteFeature.js';

/**
 * Mirrors the placed vertex at the plane `dot(n, p) = d` of `mirrorPlane` (`[n.x, n.y, n.z, d]`);
 * the frame stays where it is. `n` need not be a unit vector: `[0, 2, 0, 4]` is the plane `y = 2`.
 */
export const MirrorAtPlane = defineFeature({
  name: 'mirrorAtPlane',
  uniforms: {mirrorPlane: [0, 1, 0, 0]},
  mesh: {
    order: MeshOrder.Mirror,
    transform: (p, {uniform}) => {
      const plane = uniform<'vec4'>('mirrorPlane');
      // n and d divided by the length of n alike: the same plane, with a unit normal
      const size = length(plane.xyz);
      const n = div(plane.xyz, size);
      const d = div(plane.w, size);
      return sub(p, mul(n, mul(2, sub(dot(n, p), d)))) as unknown as Node<'vec3'>;
    },
  },
});
