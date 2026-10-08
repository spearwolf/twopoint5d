import {div, dot, max, mul, sub} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {defineFeature, MeshOrder} from '../SpriteFeature.js';

// a vertex near or above a point light comes down to this share of the height of the light before
// it is projected, so that its shadow lands at most 19 times its offset from the light — measured
// across the normal — beyond it
const MAX_POINT_SHADOW_STRETCH = 20;
const CLAMPED_SHARE = 1 - 1 / MAX_POINT_SHADOW_STRETCH;

/**
 * Projects the placed vertex from the light `shadowLight` onto the plane `dot(n, p) = d` of
 * `groundPlane` (`[n.x, n.y, n.z, d]`), both in the local space of the mesh. `shadowLight` is
 * homogeneous: `[x, y, z, 0]` is a direction towards the light, `[x, y, z, 1]` the position of a
 * point light. Works on the placed vertex, so the shadow of a billboard is the shadow of the
 * billboard the camera sees. A vertex near or above a point light is brought down along the
 * normal first; its shadow grows long but stays finite and in the plane.
 */
export const PlanarShadow = defineFeature({
  name: 'planarShadow',
  uniforms: {shadowLight: [-0.4, 1, -0.3, 0], groundPlane: [0, 1, 0, 0]},
  mesh: {
    order: MeshOrder.Project,
    transform: (p, {uniform}) => {
      const light = uniform<'vec4'>('shadowLight');
      const plane = uniform<'vec4'>('groundPlane');
      const n = plane.xyz;
      const height = sub(dot(n, p), plane.w);
      const lightHeight = sub(dot(n, light.xyz), mul(light.w, plane.w));
      // 0 for a direction (w = 0): only a point light clamps
      const excess = mul(light.w, max(sub(height, mul(lightHeight, CLAMPED_SHARE)), 0));
      const clamped = sub(p, mul(n, div(excess, dot(n, n))));
      const towardsLight = sub(light.xyz, mul(light.w, clamped));
      return sub(clamped, mul(towardsLight, div(sub(height, excess), dot(n, towardsLight)))) as unknown as Node<'vec3'>;
    },
  },
});
