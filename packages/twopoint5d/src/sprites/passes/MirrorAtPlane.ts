import {dot, mul, normalize, sub} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {defineFeature, MeshOrder} from '../SpriteFeature.js';

/** Mirrors the placed vertex at the plane `dot(n, p) = d` of `mirrorPlane`; the frame stays where it is. */
export const MirrorAtPlane = defineFeature({
  name: 'mirrorAtPlane',
  uniforms: {mirrorPlane: [0, 1, 0, 0]},
  mesh: {
    order: MeshOrder.Mirror,
    transform: (p, {uniform}) => {
      const plane = uniform<'vec4'>('mirrorPlane');
      const n = normalize(plane.xyz);
      return sub(p, mul(n, mul(2, sub(dot(n, p), plane.w)))) as unknown as Node<'vec3'>;
    },
  },
});
