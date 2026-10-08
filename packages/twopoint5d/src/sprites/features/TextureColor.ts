import {frameUv} from '../frameUv.js';
import {defineFeature} from '../SpriteFeature.js';

/**
 * The color of the sprite out of the `colorMap`, sampled at the frame. While no `colorMap` is set
 * the material draws flat grey, and swapping in a texture of the same kind costs no rebuild.
 */
export const TextureColor = defineFeature({
  name: 'textureColor',
  textures: {colorMap: {}},
  colorSource: (frame, {attribute, sample}) =>
    sample('colorMap', frameUv(frame.texCoords, attribute<'vec2'>('uv'), frame.flipDiagonal)),
});
