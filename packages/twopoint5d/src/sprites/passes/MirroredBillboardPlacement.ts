import {cameraPositionLocal, cameraUpLocal} from '../cameraNodes.js';
import {defineFeature} from '../SpriteFeature.js';
import {mirroredBillboardVertex} from './facing.js';

/**
 * The placement of `BillboardReflectionPass`: places every sprite so that, once `MirrorAtPlane`
 * has mirrored it at `mirrorPlane`, its reflection faces the camera. A mirrored billboard would face
 * the mirror image of the camera, and the camera would see it at twice its height angle above the
 * mirror — edge on at 45°, from behind beyond. This one stands at the mirror image of the instance
 * position, as large as the sprite on screen, flipped across the mirror as the camera sees it: upside
 * down below a mirror on the ground, left for right beside one. A sprite whose anchor sits at its
 * foot on the mirror meets its reflection there.
 *
 * Reads `mirrorPlane` of `MirrorAtPlane` and declares no uniform of its own.
 */
export const MirroredBillboardPlacement = defineFeature({
  name: 'mirroredBillboardPlacement',
  requires: ['instancePosition', 'mirrorAtPlane'],
  placement: (local, {attribute, uniform}) =>
    mirroredBillboardVertex({
      vertex: local,
      instancePosition: attribute<'vec3'>('instancePosition'),
      plane: uniform<'vec4'>('mirrorPlane'),
      cameraPosition: cameraPositionLocal(),
      cameraUp: cameraUpLocal(),
    }),
});
