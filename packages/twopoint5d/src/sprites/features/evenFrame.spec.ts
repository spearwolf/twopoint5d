import {uniform} from 'three/tsl';
import {describe, expect, test} from 'vitest';

import {evaluateNode} from '../../testing/spriteGraph.js';
import {evenFrameOf} from './evenFrame.js';

type Playback = 'loop' | 'once' | 'pingpong';

// a bool node evaluateNode() works out: 0 < 1 is true, 1 < 0 is false
const flag = (value: boolean) => (value ? uniform(0).lessThan(1) : uniform(1).lessThan(0));

// an animation of 4 frames, `steps` frames into it
const frameAt = (playback: Playback, steps: number): number =>
  evaluateNode(
    evenFrameOf({
      steps: uniform(steps),
      frameCount: uniform(4),
      lastFrame: uniform(3),
      isPingpong: flag(playback === 'pingpong'),
      isOnce: flag(playback === 'once'),
    }),
  ) as number;

describe('evenFrameOf()', () => {
  test('holds a looped frame within the animation where the modulo lands on frameCount', () => {
    // mod(-1e-20, 4) is exactly 4 in f64, as a division a few ULP off makes it on the gpu
    expect(frameAt('loop', -1e-20)).toBe(3);
  });

  test('holds a looped frame within the animation where the modulo lands below 0', () => {
    // -MIN_VALUE / 4 underflows to -0: the modulo stays -5e-324, and its floor is -1
    expect(frameAt('loop', -Number.MIN_VALUE)).toBe(0);
  });

  test('holds a ping-pong frame within the animation where the modulo lands below 0', () => {
    expect(frameAt('pingpong', -Number.MIN_VALUE)).toBe(0);
  });

  test('loops the frames', () => {
    expect(frameAt('loop', 5.5)).toBe(1);
  });

  test('plays the frames once and holds the first and the last', () => {
    expect(frameAt('once', 7)).toBe(3);
    expect(frameAt('once', -2)).toBe(0);
  });

  test('runs the frames back and forth', () => {
    expect(frameAt('pingpong', 4)).toBe(2);
    expect(frameAt('pingpong', 6)).toBe(0);
  });
});
