import {DoubleSide, type Vector4} from 'three/webgpu';
import type {SpriteUniformNode} from '../FeatureSprites/SpriteResources.js';
import {Darken} from './Darken.js';
import {definePass} from './definePass.js';
import {LightFacingPlacement} from './LightFacingPlacement.js';
import {MirrorAtPlane} from './MirrorAtPlane.js';
import {MirroredBillboardPlacement} from './MirroredBillboardPlacement.js';
import {PlanarShadow} from './PlanarShadow.js';
import {ShadowMask} from './ShadowMask.js';

// Both passes draw from both sides. A mirror turns the winding of every triangle, and a projection
// turns it whenever the image falls towards the camera, while three decides what to cull by the side
// of the material and the world matrix alone, never by the vertex shader: with the default
// FrontSide, a reflection on the ground and a shadow cast towards the camera would be culled.

// below this cosine between the normal and the direction towards the light, a directional light
// grazes the plane and its shadow runs off to infinity
const GRAZING_COSINE = 1e-3;

/**
 * The hook of {@link ShadowPass}: whether `shadowLight` lights the side of `groundPlane` its normal
 * points to — the side the sprites stand on. A direction (`w = 0`) has to meet the normal at a
 * cosine above 0.001; a point light (`w = 1`) has to lie above the plane.
 */
export function shadowFallsOnPlane(uniform: (name: string) => SpriteUniformNode): boolean {
  const plane = uniform('groundPlane').value as Vector4;
  const light = uniform('shadowLight').value as Vector4;
  const lightHeight = plane.x * light.x + plane.y * light.y + plane.z * light.z - light.w * plane.w;
  if (light.w !== 0) return lightHeight > 0;
  const normalLength = Math.sqrt(plane.x * plane.x + plane.y * plane.y + plane.z * plane.z);
  const lightLength = Math.sqrt(light.x * light.x + light.y * light.y + light.z * light.z);
  return lightHeight > GRAZING_COSINE * normalLength * lightLength;
}

/**
 * A planar shadow behind the sprites: each sprite turned to face the light — flat or billboard alike,
 * see {@link LightFacingPlacement} — and projected onto `groundPlane`, in `shadowColor`. It lies in
 * the ground plane, so a polygon offset pulls it in front of a ground mesh in that plane. It is left
 * out for a frame whose light does not fall onto the side of the plane its normal points to.
 */
export const ShadowPass = definePass({
  name: 'shadow',
  features: [LightFacingPlacement, PlanarShadow, ShadowMask],
  material: {
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  },
  renderOrder: -1,
  visible: shadowFallsOnPlane,
});

/**
 * A reflection behind the sprites: mirrored at `mirrorPlane`, multiplied by `reflectionColor`. It
 * lies behind the ground, so an opaque ground drawn before it hides it.
 */
export const ReflectionPass = definePass({
  name: 'reflection',
  features: [MirrorAtPlane, Darken],
  material: {transparent: true, depthWrite: false, side: DoubleSide},
  renderOrder: -1,
});

/**
 * The reflection of billboards: as {@link ReflectionPass}, but each sprite placed so that its
 * reflection faces the camera — see {@link MirroredBillboardPlacement}. For sprites drawn with
 * `BillboardPlacement`; a flat sprite takes `ReflectionPass`, whose mirror image matches it. It
 * keeps its placement through a placement swap of the sprites, and its name, `reflection`, so it
 * takes the place of `ReflectionPass`.
 */
export const BillboardReflectionPass = definePass({
  ...ReflectionPass,
  features: [MirroredBillboardPlacement, MirrorAtPlane, Darken],
});
