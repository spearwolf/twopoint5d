import {DoubleSide} from 'three/webgpu';
import {Darken} from './Darken.js';
import {definePass} from './definePass.js';
import {MirrorAtPlane} from './MirrorAtPlane.js';
import {PlanarShadow} from './PlanarShadow.js';
import {ShadowMask} from './ShadowMask.js';

// Both passes draw from both sides. A mirror turns the winding of every triangle, and a projection
// turns it whenever the image falls towards the camera, while three decides what to cull by the side
// of the material and the world matrix alone, never by the vertex shader: with the default
// FrontSide, a reflection on the ground and a shadow cast towards the camera would be culled.

/**
 * A planar shadow behind the sprites: projected onto `groundPlane`, in `shadowColor`. It lies in the
 * ground plane, so a polygon offset pulls it in front of a ground mesh in that plane.
 */
export const ShadowPass = definePass({
  name: 'shadow',
  features: [PlanarShadow, ShadowMask],
  material: {
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  },
  renderOrder: -1,
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
