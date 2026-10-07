import {rotate, vec3} from 'three/tsl';
import {defineFeature, LocalOrder} from '../SpriteFeature.js';

export interface RotationApi {
  /** The angle about z, in radians. A dynamic attribute: every `update()` uploads it. */
  rotation: number;
}

/** Turns the sprite about its pivot, after size and shear. */
export const Rotation = defineFeature<RotationApi>({
  name: 'rotation',
  attributes: {rotation: {size: 1, usage: 'dynamic'}},
  initialize() {
    this.rotation = 0;
  },
  local: {
    order: LocalOrder.Rotate,
    transform: (position, {attribute}) => rotate(position, vec3(0, 0, attribute<'float'>('rotation'))),
  },
});
