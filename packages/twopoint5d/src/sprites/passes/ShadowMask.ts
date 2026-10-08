import {mul, vec4} from 'three/tsl';
import {ColorOrder, defineFeature} from '../SpriteFeature.js';

/** Keeps the coverage of the color — its alpha — and takes the color of the shadow. */
export const ShadowMask = defineFeature({
  name: 'shadowMask',
  uniforms: {shadowColor: [0, 0, 0, 0.5]},
  color: {
    order: ColorOrder.Mask,
    transform: (c, {uniform}) => {
      const shadow = uniform<'vec4'>('shadowColor');
      return vec4(shadow.rgb, mul(c.a, shadow.a));
    },
  },
});
