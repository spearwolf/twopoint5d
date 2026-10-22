import {add, div, float, int, max, min, mod, mul, select, step, sub, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {texCoordsFromIndex} from '../node-utils.js';
import {defineFeature} from '../SpriteFeature.js';
import {evenFrameOf} from './evenFrame.js';

// The frame of an animation with per-frame durations is found by a binary search over the end times
// of its frames, unrolled to a fixed count of steps, one bit of the frame count each: a TSL `Loop`
// needs a function stack whose callback three runs while it builds the shader, and the lookups made
// there would escape `sample()`, which keeps every lookup node to hand it a new animsMap without a
// rebuild. 13 steps cover the 8191 frames `FrameBasedAnimations#add()` allows such an animation.
const SEARCH_STEPS = 13;

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
 * `time` uniform: looped, played once and held, or run back and forth, as the second header texel
 * of the animation says, at one duration or at the per-frame durations of its frames. A frame
 * texel holds the tex coords; a second texel, where there is one, the diagonal flip and the end
 * time; a third the trim margins. Until the animsMap has an image the sprite shows the whole color
 * map. `time` is declared shared: another feature that declares `{value: 0, shared: true}` reads the
 * same uniform.
 */
export const AnimatedFrames = defineFeature<AnimatedFramesApi>({
  name: 'animatedFrames',
  attributes: {anim: {components: ['animId', 'animOffset']}},
  // shared: a wave, a bob or a particle of another feature reads the same time
  uniforms: {time: {value: 0, shared: true}},
  textures: {animsMap: {needsImage: true}},
  initialize() {
    this.animId = 0;
    this.animOffset = 0;
  },
  frame: ({attribute, uniform, sample, textureSize}) => {
    const size = textureSize('animsMap');
    const time = uniform<'float'>('time');
    const anim = attribute<'vec2'>('anim');
    const lookup = (index: Node<'int'>) => sample('animsMap', texCoordsFromIndex(size, index));

    // the header texel of an animation: [frameCount, duration, first frame texel, texelsPerFrame]
    const header = lookup(anim.x.toInt());
    const frameCount = header.x;
    const duration = header.y;
    const firstFrameTexel = header.z;
    // an animsMap built by hand with a 0 in the last field of the header reads as one texel per
    // frame, the layout it was written for
    const texelsPerFrame = max(header.w, float(1));
    const lastFrame = max(sub(frameCount, 1), float(0));

    // the second header texel sits behind the frames: [playback, hasDurations, cycleDuration, -2].
    // A texel whose fourth component is not below -1.5 is no second header — an animsMap of the
    // layout before it, whose animations all loop at one duration. No texel of that layout goes
    // below -1: the lowest is the `v` of a frame flipped vertically and as high as its image
    const second = lookup(add(firstFrameTexel, mul(frameCount, texelsPerFrame)).toInt());
    const isSecondHeader = second.w.lessThan(-1.5);
    const playback = select(isSecondHeader, second.x, float(0));
    const isPingpong = playback.greaterThan(1.5);
    const isOnce = playback.greaterThan(0.5).and(isPingpong.not());
    const hasDurations = isSecondHeader.and(second.y.greaterThan(0.5));
    const cycleDuration = select(isSecondHeader, second.z, duration);

    const t = add(time, anim.y);

    // One duration: the frames elapsed are t / duration · frameCount
    const steps = mul(div(t, duration), frameCount);
    const evenFrame = evenFrameOf({steps, frameCount, lastFrame, isPingpong, isOnce});

    // Per-frame durations: the end time of frame k sits in the fourth component of its second
    // texel. The frame is the count of frames that end at or before the time searched for; the way
    // back of a ping-pong mirrors its time into the way there, over the frames frameCount − 2 down
    // to 1. The count is built bit by bit, from 4096 down to 1: a step takes its bit when the frame
    // before the candidate ends in time. A candidate past the last frame reads the last frame, which
    // ends at the duration — taken only once every frame has ended, and the count is clamped to the
    // last frame anyway. Each step reads the count before it twice and nothing else of it, so the
    // graph stays a chain a walk over its nodes can follow
    const endTimeOf = (frame: Node<'float'>) => lookup(add(firstFrameTexel, add(mul(frame, texelsPerFrame), 1)).toInt()).w;
    const turnTime = mod(t, cycleDuration);
    const isWayBack = isPingpong.and(turnTime.greaterThanEqual(duration));
    const searched = select(
      isPingpong,
      select(isWayBack, sub(add(cycleDuration, endTimeOf(float(0))), turnTime), turnTime),
      select(isOnce, t, mod(t, duration)),
    );
    // an animation without durations searches no frame: every one of its steps reads the same texel
    const searchedFrames = select(hasDurations, frameCount, float(1));
    let count: Node<'float'> = float(0);
    for (let bit = SEARCH_STEPS - 1; bit >= 0; bit--) {
      const candidate = add(count, 2 ** bit);
      const endTime = endTimeOf(sub(min(candidate, searchedFrames), 1));
      // step(edge, x) is 1 for x ≥ edge: the frame before the candidate has ended
      count = add(count, mul(step(endTime, searched), 2 ** bit));
    }
    const walkedFrame = min(count, lastFrame).toInt();

    // a duration of 0 is a still image, its first frame, and the division by it drops out
    const frameIndex = select(duration.greaterThan(0), select(hasDurations, walkedFrame, evenFrame), int(0));
    const frameTexel = add(firstFrameTexel.toInt(), mul(frameIndex, texelsPerFrame.toInt())).toInt();

    const texCoords = lookup(frameTexel);
    // the second texel of a frame is [width, height, flipDiagonal, endTime]; a frame of one texel is never turned
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
