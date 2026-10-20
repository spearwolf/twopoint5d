import {mul, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {ColorOrder, defineFeature} from '../SpriteFeature.js';

export interface FadeApi {
  /**
   * Multiplies the alpha of the sprite: 1, what a new sprite starts with, draws it as it is, 0 not
   * at all. A fade between 0 and 1 blends only on a material with `transparent: true`, and under the
   * default alpha test a sprite faded to 0 is not drawn.
   *
   * `fade` is a dynamic attribute: every `update()` uploads it. A kind whose sprites fade once takes
   * `attributeUsage: {static: ['fade']}`.
   */
  fade: number;
}

/**
 * Fades the sprite: multiplies its alpha by the `fade` attribute, in the band `ColorOrder.Fade` —
 * spawning, dying, fog of war.
 */
export const Fade = defineFeature<FadeApi>({
  name: 'fade',
  attributes: {fade: {size: 1, usage: 'dynamic'}},
  initialize() {
    this.fade = 1;
  },
  color: {
    order: ColorOrder.Fade,
    transform: (color, {attribute}) => vec4(color.rgb, mul(color.a, attribute<'float'>('fade'))) as unknown as Node<'vec4'>,
  },
});
