import {mul} from 'three/tsl';
import {ColorOrder, defineFeature} from '../SpriteFeature.js';

/** Multiplies the color by `reflectionColor`, alpha included: a darker, fainter reflection. */
export const Darken = defineFeature({
  name: 'darken',
  uniforms: {reflectionColor: [0.5, 0.5, 0.5, 0.5]},
  color: {order: ColorOrder.Fade, transform: (c, {uniform}) => mul(c, uniform<'vec4'>('reflectionColor'))},
});
