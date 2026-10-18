import {ColorOrder, defineFeature} from '@spearwolf/twopoint5d';
import {frontFacing, select, vec4} from 'three/tsl';
import {Color, type Node} from 'three/webgpu';

// the grey brown of the back of a printed sheet; a uniform holds linear values, Color converts the sRGB
const back = new Color('#8c8274');

export interface CardboardBackApi {
  /** 1 for a sheet printed on both sides: its back shows the print mirrored. A new sprite starts at 0. */
  twoSided: number;
}

/**
 * The back of a cut-out: a face the camera sees from behind shows plain cardboard instead of the
 * print mirrored, and keeps the alpha of the print — the outline stays — unless the sprite is
 * printed on both sides. For a material with `side: DoubleSide`; a feature of the demo's own, with
 * an attribute of its own and a color stage beside the built-in ones.
 */
export const CardboardBack = defineFeature<CardboardBackApi>({
  name: 'cardboardBack',
  attributes: {twoSided: {size: 1}},
  uniforms: {cardboardColor: [back.r, back.g, back.b]},
  initialize() {
    this.twoSided = 0;
  },
  color: {
    order: ColorOrder.Mask,
    transform: (color, {attribute, uniform}) =>
      select(
        frontFacing.or(attribute<'float'>('twoSided').greaterThan(0.5)),
        color,
        vec4(uniform<'vec3'>('cardboardColor'), color.a),
      ) as unknown as Node<'vec4'>,
  },
});
