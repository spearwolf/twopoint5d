import {add, div, float, int, max, mod, mul, select, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {texCoordsFromIndex} from '../node-utils.js';
import {defineFeature} from '../SpriteFeature.js';

export interface AnimatedFramesApi {
  /**
   * The animation of the animsMap the sprite plays.
   *
   * `anim` — `animId` and `animOffset` — is a static attribute: a later change reaches the gpu once
   * it is marked — `spritePool.touchVO(sprite, 'anim')` or `geometry.touch('anim')` — or with every
   * `update()` in a geometry built with `attributeUsage: {dynamic: ['anim']}`.
   */
  animId: number;
  /** The time, in seconds, the animation of the sprite is ahead of the `time` uniform. Part of `anim`. */
  animOffset: number;
}

/**
 * The frame out of the `animsMap` a `FrameBasedAnimations#bakeDataTexture()` writes, at the
 * `time` uniform. A frame texel holds the tex coords; a second texel, where there is one, the
 * diagonal flip; a third the trim margins. Until the animsMap has an image the sprite shows the
 * whole color map.
 */
export const AnimatedFrames = defineFeature<AnimatedFramesApi>({
  name: 'animatedFrames',
  attributes: {anim: {components: ['animId', 'animOffset']}},
  uniforms: {time: 0},
  textures: {animsMap: {needsImage: true}},
  initialize() {
    this.animId = 0;
    this.animOffset = 0;
  },
  frame: ({attribute, uniform, sample, textureSize}) => {
    const size = textureSize('animsMap');
    const time = uniform<'float'>('time');
    const anim = attribute<'vec2'>('anim');
    const lookup = (index: Node<'int'>) => sample('animsMap', texCoordsFromIndex(size, index) as unknown as Node<'vec2'>);

    // the header texel of an animation: [frameCount, duration, first frame texel, texelsPerFrame]
    const header = lookup(anim.x.toInt());
    // a duration of 0 is a still image, its first frame, and the division by it drops out. Both
    // branches are ints already: a select() converted to an int afterwards comes out of the WGSL
    // builder as a float in one of the places it is read, and the shader fails to compile
    const frameIndex = select(
      header.y.greaterThan(0),
      mod(mul(div(add(time, anim.y), header.y), header.x), header.x)
        .floor()
        .toInt(),
      int(0),
    );
    // an animsMap built by hand with a 0 in the last field of the header reads as one texel per
    // frame, the layout it was written for
    const texelsPerFrame = max(header.w, float(1));
    const frameTexel = add(header.z.toInt(), mul(frameIndex, texelsPerFrame.toInt())).toInt();

    const texCoords = lookup(frameTexel);
    // the second texel of a frame is [width, height, flipDiagonal, 0]; a frame of one texel is never turned
    const flip = lookup(add(frameTexel, 1).toInt());
    // the third texel of a frame is [left, top, right, bottom]; a frame of one or two texels is untrimmed
    const trim = lookup(add(frameTexel, 2).toInt());

    return {
      texCoords,
      flipDiagonal: select(texelsPerFrame.greaterThan(1.5), flip.z, float(0)),
      trim: select(texelsPerFrame.greaterThan(2.5), trim, vec4(0, 0, 0, 0)),
    };
  },
});
