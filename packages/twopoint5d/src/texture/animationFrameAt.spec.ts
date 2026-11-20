import {describe, expect, test} from 'vitest';

import {animationFrameAt, type AnimationTiming} from './animationFrameAt.js';
import {type AnimationPlayback, FrameBasedAnimations} from './FrameBasedAnimations.js';
import {TextureCoords} from './TextureCoords.js';

// the floored mod of the shader: x − y · floor(x / y), never the remainder of `%`
const mod = (x: number, y: number) => x - y * Math.floor(x / y);
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

// the end times of the frames, as the animsMap bakes them into the second texel of each frame
const endTimesOf = (frameCount: number, duration: number, durations: readonly number[] | undefined): number[] => {
  const ends: number[] = [];
  if (durations) {
    let end = 0;
    for (const d of durations) ends.push((end += d));
  } else {
    for (let i = 1; i <= frameCount; i++) ends.push((i * duration) / frameCount);
  }
  return ends;
};

// the cycle duration of the second header texel
const cycleDurationOf = (timing: AnimationTiming): number => {
  const {playback, frameCount, duration, durations} = timing;
  if (playback !== 'pingpong' || frameCount < 2) return duration;
  if (durations) return 2 * duration - durations[0]! - durations[frameCount - 1]!;
  return ((2 * frameCount - 2) / frameCount) * duration;
};

// A straightforward port of the arithmetic of `AnimatedFrames` and `evenFrameOf()`. It shares no
// code with the implementation.
function shaderFrame(timing: AnimationTiming, t: number): number {
  const {playback, frameCount, duration, durations} = timing;
  const lastFrame = Math.max(frameCount - 1, 0);
  if (!(duration > 0)) return 0;
  const isPingpong = playback === 'pingpong';
  const isOnce = playback === 'once';

  if (!durations) {
    const steps = (t / duration) * frameCount;
    if (isPingpong) {
      const turnStep = Math.floor(mod(steps, Math.max(2 * frameCount - 2, 1)));
      return clamp(lastFrame - Math.abs(turnStep - lastFrame), 0, lastFrame);
    }
    if (isOnce) return clamp(Math.floor(steps), 0, lastFrame);
    return clamp(Math.floor(mod(steps, frameCount)), 0, lastFrame);
  }

  const ends = endTimesOf(frameCount, duration, durations);
  const cycleDuration = cycleDurationOf(timing);
  const turnTime = mod(t, cycleDuration);
  const isWayBack = isPingpong && turnTime >= duration;
  let searched: number;
  if (isPingpong) searched = isWayBack ? cycleDuration + ends[0]! - turnTime : turnTime;
  else if (isOnce) searched = t;
  else searched = mod(t, duration);
  // the binary search of the shader counts the frames that have ended at or before `searched`
  let count = 0;
  for (const end of ends) if (end <= searched) count++;
  return Math.min(count, lastFrame);
}

const PLAYBACKS: AnimationPlayback[] = ['loop', 'once', 'pingpong'];

const sheet = new TextureCoords(0, 0, 256, 32);
const framesOf = (n: number) => Array.from({length: n}, (_, i) => new TextureCoords(sheet, i * 32, 0, 32, 32));

const cases: {name: string; timing: AnimationTiming}[] = PLAYBACKS.flatMap((playback) => [
  {name: `${playback}, one duration`, timing: {playback, frameCount: 5, duration: 1.5, durations: undefined}},
  {name: `${playback}, durations`, timing: {playback, frameCount: 5, duration: 1.5, durations: [0.1, 0.4, 0.2, 0.3, 0.5]}},
  {name: `${playback}, two frames`, timing: {playback, frameCount: 2, duration: 1, durations: [0.25, 0.75]}},
]);

// every frame edge of the timing: the ends of the frames, and the ends of the way back of a ping-pong
function edgesOf(timing: AnimationTiming): number[] {
  const {playback, frameCount, duration, durations} = timing;
  const ends = endTimesOf(frameCount, duration, durations);
  const edges = [0, ...ends];
  if (playback === 'pingpong' && frameCount >= 2) {
    const cycle = cycleDurationOf(timing);
    for (const end of ends) edges.push(cycle + ends[0]! - end);
    edges.push(cycle);
  }
  return edges;
}

describe('animationFrameAt()', () => {
  for (const {name, timing} of cases) {
    test(`${name}: equals the shader at every frame edge ± 1e-6 s`, () => {
      const cycle = cycleDurationOf(timing);
      for (const edge of edgesOf(timing)) {
        for (const base of [edge, edge + cycle, edge + 10 * cycle]) {
          for (const seconds of [base - 1e-6, base + 1e-6]) {
            expect(animationFrameAt(timing, seconds), `${seconds} s`).toBe(shaderFrame(timing, seconds));
          }
        }
      }
    });

    test(`${name}: equals the shader before the start and 10 cycles past the end`, () => {
      const cycle = cycleDurationOf(timing);
      for (const seconds of [-0.3, -7.77, 0.123, cycle * 10 + 0.31, cycle * 21.7]) {
        expect(animationFrameAt(timing, seconds), `${seconds} s`).toBe(shaderFrame(timing, seconds));
      }
    });
  }

  test('a loop walks 0 1 2 3 and starts again', () => {
    const timing: AnimationTiming = {playback: 'loop', frameCount: 4, duration: 1, durations: undefined};
    expect([0.1, 0.35, 0.6, 0.85, 1.1, -0.1].map((s) => animationFrameAt(timing, s))).toEqual([0, 1, 2, 3, 0, 3]);
  });

  test('a once holds the first frame before the start and the last one after the end', () => {
    const timing: AnimationTiming = {playback: 'once', frameCount: 4, duration: 1, durations: undefined};
    expect(animationFrameAt(timing, -5)).toBe(0);
    expect(animationFrameAt(timing, 99)).toBe(3);
  });

  test('a pingpong shows each end frame once per turn', () => {
    const timing: AnimationTiming = {playback: 'pingpong', frameCount: 4, duration: 1, durations: undefined};
    // a turn is 6 frames of 0.25 s
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => animationFrameAt(timing, 0.25 * i + 0.01))).toEqual([0, 1, 2, 3, 2, 1, 0, 1]);
  });

  test('a duration of 0 answers frame 0', () => {
    expect(animationFrameAt({playback: 'loop', frameCount: 4, duration: 0, durations: undefined}, 3.3)).toBe(0);
    expect(animationFrameAt({playback: 'pingpong', frameCount: 4, duration: 0, durations: undefined}, 3.3)).toBe(0);
  });

  test('a single frame answers 0 in every playback', () => {
    for (const playback of PLAYBACKS) {
      expect(animationFrameAt({playback, frameCount: 1, duration: 1, durations: undefined}, 4.2)).toBe(0);
      expect(animationFrameAt({playback, frameCount: 1, duration: 2, durations: [2]}, -4.2)).toBe(0);
    }
  });

  test.each([0, 1.5, Number.NaN, -1, Number.POSITIVE_INFINITY])('refuses a frameCount of %s', (frameCount) => {
    expect(() => animationFrameAt({playback: 'loop', frameCount, duration: 1, durations: undefined}, 0)).toThrow(
      /^animationFrameAt: frameCount must be a whole number of 1 or more, got /,
    );
  });

  test('refuses seconds that are no finite number', () => {
    const timing: AnimationTiming = {playback: 'loop', frameCount: 2, duration: 1, durations: undefined};
    expect(() => animationFrameAt(timing, Number.NaN)).toThrow(/^animationFrameAt: seconds must be a finite number, got NaN/);
  });

  test('takes a FrameBasedAnimationInfo as it is', () => {
    const anims = new FrameBasedAnimations();
    const attack = anims.add('attack', {durations: [0.05, 0.05, 0.3, 0.1], playback: 'once'}, framesOf(4));
    const info = anims.animation(attack);
    const timing: AnimationTiming = info; // assignable without a cast
    expect(animationFrameAt(timing, 0.01)).toBe(0);
    expect(animationFrameAt(info, 0.2)).toBe(2);
    expect(animationFrameAt(info, 9)).toBe(3);
  });
});
