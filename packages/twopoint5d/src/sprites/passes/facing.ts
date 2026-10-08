import {add, cross, div, dot, length, max, mul, normalize, sub} from 'three/tsl';
import type {Node} from 'three/webgpu';

// within this sine between the normal of the plane and the direction towards the light, the up of
// a light-facing quad turns over from the normal to the view of the camera; the normal alone
// leaves up undefined for a light straight above the plane
const ZENITH_SINE = 0.1;

// the length below which the normal, carried into the plane of a billboard, counts as none
const NO_LENGTH = 1e-6;

type Vec3 = Node<'vec3'>;

// the right and up of a quad facing along `look` (towards the viewer), up as close to `up` as that
// allows — the frame of a billboard, which takes the up of the camera for `up`
const facingFrame = (look: Vec3, up: Vec3): {right: Vec3; up: Vec3} => {
  const right = normalize(cross(up, look)) as unknown as Vec3;
  return {right, up: cross(look, right) as unknown as Vec3};
};

// v mirrored at a plane through the origin with the unit normal n
const mirrored = (v: Vec3, n: Vec3): Vec3 => sub(v, mul(n, mul(2, dot(v, n)))) as unknown as Vec3;

const onFrame = (origin: Vec3, vertex: Vec3, right: Vec3, up: Vec3): Vec3 =>
  add(origin, add(mul(right, vertex.x), mul(up, vertex.y))) as unknown as Vec3;

/**
 * The vertex of a quad that turns about its instance position to face the light: x and y of the
 * local vertex go onto a right and an up across the direction towards the light, `light` as
 * `PlanarShadow` reads it — `[x, y, z, 0]` a direction, `[x, y, z, 1]` a point. Up is the normal
 * of `plane` as far as it lies across that direction, so that projected onto the plane the quad
 * runs straight away from the light; for a light within a sine of 0.1 of the normal it turns over
 * to the up of the camera less its back — the top of the quad away from the camera. All in the
 * local space of the mesh.
 *
 * @internal
 */
export function lightFacingVertex(params: {
  vertex: Vec3;
  instancePosition: Vec3;
  light: Node<'vec4'>;
  plane: Node<'vec4'>;
  cameraUp: Vec3;
  cameraBack: Vec3;
}): Vec3 {
  const {vertex, instancePosition, light, plane, cameraUp, cameraBack} = params;
  const towardsLight = normalize(sub(light.xyz, mul(light.w, instancePosition))) as unknown as Vec3;
  const normal = normalize(plane.xyz) as unknown as Vec3;
  const sine = length(cross(normal, towardsLight));
  const viewWeight = max(sub(1, div(sine, ZENITH_SINE)), 0);
  const up = add(normal, mul(sub(cameraUp, cameraBack), viewWeight)) as unknown as Vec3;
  const frame = facingFrame(towardsLight, up);
  return onFrame(instancePosition, vertex, frame.right, frame.up);
}

/**
 * The vertex of the reflection of a billboard before `MirrorAtPlane` mirrors it at `plane`: once
 * mirrored, the quad stands at the mirror image of the instance position and faces the camera — not
 * the mirror image of the camera, which a mirrored billboard would face — flipped within its own
 * plane across the normal of `plane` as the camera sees it. A mirror on the ground hangs the sprite
 * upside down, one beside it turns it left for right. `cameraPosition` and `cameraUp` are in the
 * local space of the mesh.
 *
 * @internal
 */
export function mirroredBillboardVertex(params: {
  vertex: Vec3;
  instancePosition: Vec3;
  plane: Node<'vec4'>;
  cameraPosition: Vec3;
  cameraUp: Vec3;
}): Vec3 {
  const {vertex, instancePosition, plane, cameraPosition, cameraUp} = params;
  const size = length(plane.xyz);
  const normal = div(plane.xyz, size) as unknown as Vec3;
  const offset = sub(dot(normal, instancePosition), div(plane.w, size));
  const mirroredPosition = sub(instancePosition, mul(normal, mul(2, offset))) as unknown as Vec3;

  const look = normalize(sub(cameraPosition, mirroredPosition)) as unknown as Vec3;
  const frame = facingFrame(look, cameraUp);
  // the normal as the camera sees it: carried into the plane of the billboard
  const across = sub(normal, mul(look, dot(normal, look))) as unknown as Vec3;
  const acrossUnit = div(across, max(length(across), NO_LENGTH)) as unknown as Vec3;
  const right = mirrored(frame.right, acrossUnit);
  const up = mirrored(frame.up, acrossUnit);
  // the vertex before the mirror: the flipped frame mirrored once more, about the instance position
  return onFrame(instancePosition, vertex, mirrored(right, normal), mirrored(up, normal));
}
