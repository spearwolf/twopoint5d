import {cameraBackLocal, cameraUpLocal} from '../cameraNodes.js';
import {defineFeature} from '../SpriteFeature.js';
import {lightFacingVertex} from './facing.js';

/**
 * The placement of `ShadowPass`: turns every sprite about its instance position to face the light
 * `shadowLight` of `PlanarShadow`, whatever placement the sprites are drawn with, so that the shadow
 * is that of the sprite as the light would see it turned towards itself — never thinner than the
 * sprite, however the sprite stands to the light. The local x of the sprite runs across the light and
 * level with `groundPlane`, its y up and away from the light; for a light within a sine of 0.1 of the
 * normal of the plane, the top turns away from the camera instead. A light behind the sprite sees
 * its face too, so that shadow shows the sprite left for right as the camera sees it.
 *
 * Reads the uniforms of `PlanarShadow` and declares none of its own.
 */
export const LightFacingPlacement = defineFeature({
  name: 'lightFacingPlacement',
  requires: ['instancePosition', 'planarShadow'],
  placement: (local, {attribute, uniform}) =>
    lightFacingVertex({
      vertex: local,
      instancePosition: attribute<'vec3'>('instancePosition'),
      light: uniform<'vec4'>('shadowLight'),
      plane: uniform<'vec4'>('groundPlane'),
      cameraUp: cameraUpLocal(),
      cameraBack: cameraBackLocal(),
    }),
});
