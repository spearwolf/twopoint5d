import {vertexByInstancePosition} from '../node-utils.js';
import {defineFeature} from '../SpriteFeature.js';

/** Places the sprite flat in the XY plane of its mesh, at its instance position. */
export const FlatPlacement = defineFeature({
  name: 'flatPlacement',
  requires: ['instancePosition'],
  placement: (local, {attribute}) =>
    vertexByInstancePosition({vertexPosition: local, instancePosition: attribute<'vec3'>('instancePosition')}),
});
