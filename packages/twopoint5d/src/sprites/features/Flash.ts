import {mix, vec4} from 'three/tsl';
import {ColorOrder, defineFeature} from '../SpriteFeature.js';

export interface FlashApi {
  /** The red of the flash color. Part of `flash`. */
  flashR: number;
  /** The green of the flash color. Part of `flash`. */
  flashG: number;
  /** The blue of the flash color. Part of `flash`. */
  flashB: number;
  /**
   * How far the color of the sprite is mixed towards the flash color: 0, what a new sprite starts
   * with, not at all, 1 all the way. A weight, not an alpha: the alpha of the sprite stays. Part of
   * `flash`.
   */
  flashAmount: number;
  /**
   * Sets the flash color and how far the sprite is mixed towards it: `setFlash(1, 1, 1, 0.8)` turns
   * it nearly white, `flashAmount = 0` ends the flash. A color above 1 is brighter than white, and
   * glows under a bloom — see "Glow" in `docs/sprites.md`.
   *
   * `flash` is a dynamic attribute: every `update()` uploads it.
   */
  setFlash(r: number, g: number, b: number, amount: number): void;
  /** A tuple of fewer values leaves the rest as it is. */
  setFlash(flash: [r: number, g: number, b: number, amount?: number]): void;
}

/**
 * Mixes the color of the sprite towards a flash color by `flashAmount`, alpha kept, in the band
 * `ColorOrder.Flash`: a hit flash, a freeze tint, a damage blink — what a `Tint`, which only
 * multiplies, cannot do.
 */
export const Flash = defineFeature<FlashApi>({
  name: 'flash',
  attributes: {flash: {components: ['flashR', 'flashG', 'flashB', 'flashAmount'], usage: 'dynamic'}},
  initialize() {
    // white, not mixed in: 0 would be a flash towards black
    this.setFlash(1, 1, 1, 0);
  },
  color: {
    order: ColorOrder.Flash,
    transform: (color, {attribute}) => {
      const flash = attribute<'vec4'>('flash');
      return vec4(mix(color.rgb, flash.rgb, flash.w), color.a);
    },
  },
});
