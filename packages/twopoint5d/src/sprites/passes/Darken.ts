import {mul} from 'three/tsl';
import {ColorOrder, defineFeature} from '../SpriteFeature.js';

/**
 * Multiplies the color by `reflectionColor`, alpha included: a darker, fainter reflection. It runs
 * in the band `ColorOrder.Pass`, after every color stage of the kind, so a flash is darkened too.
 */
export const Darken = defineFeature({
  name: 'darken',
  uniforms: {reflectionColor: [0.5, 0.5, 0.5, 0.5]},
  color: {order: ColorOrder.Pass, transform: (c, {uniform}) => mul(c, uniform<'vec4'>('reflectionColor'))},
});
