import {add, div, dot, length, max, mul, normalize, select, sub, vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';

type Vec3 = Node<'vec3'>;

// within this sine between the axis and the direction towards the camera, the right of the quad
// turns over to the right of the camera: straight along the axis the facing is undefined
const ZENITH_SINE = 0.1;

/**
 * The vertex of a quad that turns about `axis` through its instance position to face the camera
 * and stays upright along the axis: x of the local vertex goes onto a right across the axis and
 * the direction towards the camera, y onto the axis. Within a sine of 0.1 of the axis the right
 * turns over to the right of the camera, levelled and turned to the side the right across the axis
 * points to, so that the two never cancel. All in the local space of the mesh.
 *
 * @internal
 */
export function axisBillboardVertex(params: {
  vertex: Vec3;
  instancePosition: Vec3;
  axis: 'y' | 'z';
  cameraPosition: Vec3;
  cameraRight: Vec3;
}): Vec3 {
  const {vertex, instancePosition, axis, cameraPosition, cameraRight} = params;
  const look = normalize(sub(cameraPosition, instancePosition)) as unknown as Vec3;
  // cross(axis, look), and the right of the camera less its part along the axis, as swizzles
  const across = (axis === 'y' ? vec3(look.z, 0, look.x.negate()) : vec3(look.y.negate(), look.x, 0)) as unknown as Vec3;
  const level = (axis === 'y' ? vec3(cameraRight.x, 0, cameraRight.z) : vec3(cameraRight.x, cameraRight.y, 0)) as unknown as Vec3;
  const weight = max(sub(1, div(length(across), ZENITH_SINE)), 0);
  const aligned = select(dot(level, across).lessThan(0), level.negate(), level) as unknown as Vec3;
  const right = normalize(add(across, mul(aligned, weight))) as unknown as Vec3;
  const up = (axis === 'y' ? vec3(0, 1, 0) : vec3(0, 0, 1)) as unknown as Vec3;
  return add(instancePosition, add(mul(right, vertex.x), mul(up, vertex.y))) as unknown as Vec3;
}
