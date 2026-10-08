import {div, dot, mul, sub} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {defineFeature, MeshOrder} from '../SpriteFeature.js';

/**
 * Projects the placed vertex along `lightDirection` onto the plane `dot(n, p) = d` of
 * `groundPlane` (`[n.x, n.y, n.z, d]`), both in the local space of the mesh. Works on the placed
 * vertex, so the shadow of a billboard is the shadow of the billboard the camera sees.
 */
export const PlanarShadow = defineFeature({
  name: 'planarShadow',
  uniforms: {lightDirection: [0.4, -1, 0.3], groundPlane: [0, 1, 0, 0]},
  mesh: {
    order: MeshOrder.Project,
    transform: (p, {uniform}) => {
      const light = uniform<'vec3'>('lightDirection');
      const plane = uniform<'vec4'>('groundPlane');
      const distance = div(sub(dot(plane.xyz, p), plane.w), dot(plane.xyz, light));
      return sub(p, mul(light, distance)) as unknown as Node<'vec3'>;
    },
  },
});
