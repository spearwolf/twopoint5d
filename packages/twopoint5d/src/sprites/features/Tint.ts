import {mul} from 'three/tsl';
import {Color} from 'three/webgpu';
import {ColorOrder, defineFeature} from '../SpriteFeature.js';

export interface TintApi {
  r: number;
  g: number;
  b: number;
  a: number;
  /** Sets the color that tints the sprite, alpha included — see {@link TintApi.setColor}. */
  setColorValues(r: number, g: number, b: number, a: number): void;
  /** A tuple of three values writes `r`, `g` and `b` and leaves the alpha as it is. */
  setColorValues(color: [r: number, g: number, b: number, a?: number]): void;
  /**
   * Sets the color that tints the sprite. The material multiplies what it draws by it,
   * alpha included; white, the color every sprite starts with, leaves the sprite as it is. Without
   * an `a` the sprite keeps the alpha it has; a sprite out of `createSprite()` starts with an alpha
   * of 1.
   *
   * An alpha between 0 and 1 blends only on a material with `transparent: true`, and under the
   * default alpha test a sprite with an alpha of 0 is not drawn at all.
   *
   * `color` is a static attribute. What is written to it before the first `update()` after
   * `createSprite()` reaches the gpu with it; a later change reaches the gpu only once it is marked
   * for upload — `spritePool.touchVO(sprite, 'color')` for this sprite alone,
   * `geometry.touch('color')` for every sprite in use. A color that changes every frame belongs in a
   * geometry built with `attributeUsage: {dynamic: ['color']}`, whose attribute uploads with every
   * `update()`.
   */
  setColor(color: Color, a?: number): void;
  /**
   * Answers `r`, `g` and `b` of the sprite in `target`; the alpha is not part of a `Color`, read `a`
   * for it. Without a `target` every call builds a new `Color` — in an update loop, hand in one that
   * is reused.
   */
  getColor(target?: Color): Color;
}

const colorScratch: [r: number, g: number, b: number, a: number] = [0, 0, 0, 0];
// a tuple of its own for the three values: an undefined in the one above would turn it away from plain doubles
const colorRGBScratch: [r: number, g: number, b: number] = [0, 0, 0];

/**
 * Multiplies the color of the sprite by its `color` attribute, alpha included. The attribute keeps
 * the name and the api the textured sprites always had, so `touch('color')` keeps working.
 */
export const Tint = defineFeature<TintApi>({
  name: 'tint',
  attributes: {color: {components: ['r', 'g', 'b', 'a'], setter: 'setColorValues', getter: false}},
  methods: {
    setColor(color: Color, a?: number) {
      if (a === undefined) {
        colorRGBScratch[0] = color.r;
        colorRGBScratch[1] = color.g;
        colorRGBScratch[2] = color.b;
        this.setColorValues(colorRGBScratch);
        return;
      }
      colorScratch[0] = color.r;
      colorScratch[1] = color.g;
      colorScratch[2] = color.b;
      colorScratch[3] = a;
      this.setColorValues(colorScratch);
    },
    getColor(target: Color = new Color()) {
      return target.set(this.r, this.g, this.b);
    },
  },
  initialize() {
    // 0 is not neutral for a tint: a new sprite starts white
    this.setColorValues(1, 1, 1, 1);
  },
  color: {order: ColorOrder.Tint, transform: (color, {attribute}) => mul(color, attribute<'vec4'>('color'))},
});
