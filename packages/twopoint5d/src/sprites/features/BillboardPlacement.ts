import {vec3} from 'three/tsl';
import {billboardVertexByInstancePosition} from '../node-utils.js';
import {defineFeature} from '../SpriteFeature.js';

/**
 * Turns the sprite about its instance position to face the camera: the x and y of the local
 * vertex — trimmed, scaled, sheared and turned already — go onto the camera's right and up
 * vectors in the local space of the mesh. A mesh may be moved, turned and scaled evenly.
 */
export const BillboardPlacement = defineFeature({
  name: 'billboardPlacement',
  requires: ['instancePosition'],
  // the local vertex arrives scaled already; without a scale of its own the helper would fall
  // back to the quadSize attribute and scale it a second time
  placement: (local, {attribute}) =>
    billboardVertexByInstancePosition({
      vertexPosition: local,
      instancePosition: attribute<'vec3'>('instancePosition'),
      scale: vec3(1, 1, 1),
    }),
});
