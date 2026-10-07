import {add, mul, vec3} from 'three/tsl';
import {defineFeature, LocalOrder} from '../SpriteFeature.js';

export interface ShearApi {
  shearX: number;
  shearY: number;
  /** `x` moves each vertex along x by its y, `y` along y by its x — both in the scaled quad. A dynamic attribute. */
  setShear(x: number, y: number): void;
  setShear(shear: [x: number, y: number]): void;
}

/** Shears the sprite after its size and before its rotation: an italic sprite stays italic when it turns. */
export const Shear = defineFeature<ShearApi>({
  name: 'shear',
  attributes: {shear: {components: ['shearX', 'shearY'], usage: 'dynamic'}},
  initialize() {
    this.setShear(0, 0);
  },
  local: {
    order: LocalOrder.Shear,
    transform: (position, {attribute}) => {
      const shear = attribute<'vec2'>('shear');
      return vec3(add(position.x, mul(position.y, shear.x)), add(position.y, mul(position.x, shear.y)), position.z);
    },
  },
});
