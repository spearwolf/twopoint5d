import {mul, vec3} from 'three/tsl';
import {defineFeature, LocalOrder} from '../SpriteFeature.js';

export interface QuadSizeApi {
  width: number;
  height: number;
  setQuadSize(width: number, height: number): void;
  setQuadSize(quadSize: [width: number, height: number]): void;
  /**
   * Sets the size of the quad of the sprite.
   *
   * `quadSize` is a static attribute. What is written to it before the first `update()` after
   * `createSprite()` reaches the gpu with it; a later change reaches the gpu only once it is marked
   * for upload — `spritePool.touchVO(sprite, 'quadSize')` for this sprite alone,
   * `geometry.touch('quadSize')` for every sprite in use. A size that changes every frame belongs in
   * a geometry built with `attributeUsage: {dynamic: ['size']}`.
   */
  setSize(width: number, height: number): void;
}

// see InstancePosition: one tuple per call site keeps the fractional values unboxed
const quadSizeScratch: [width: number, height: number] = [0, 0];

/** The size of the sprite: scales the unit quad, before shear and rotation. */
export const QuadSize = defineFeature<QuadSizeApi>({
  name: 'quadSize',
  attributes: {quadSize: {components: ['width', 'height']}},
  usageAliases: {size: ['quadSize']},
  methods: {
    setSize(width: number, height: number) {
      quadSizeScratch[0] = width;
      quadSizeScratch[1] = height;
      this.setQuadSize(quadSizeScratch);
    },
  },
  initialize() {
    this.setQuadSize(0, 0);
  },
  // scale before rotate: the other way round turns the unit quad and stretches the result, and a
  // sprite that is not square comes out as a parallelogram
  local: {order: LocalOrder.Scale, transform: (position, {attribute}) => mul(position, vec3(attribute<'vec2'>('quadSize'), 1))},
});
