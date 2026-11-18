import type {WebGPURenderer} from 'three/webgpu';
import {describe, expect, it, vi} from 'vitest';
import {AnimationLoopHold} from './AnimationLoopHold.js';

// what the hold reads of a renderer: the animation loop of three in `_animation`, and the callback
// that loop carries
function makeRenderer(animation: object | undefined, loop: (() => void) | null = null) {
  return {_animation: animation, getAnimationLoop: vi.fn(() => loop)} as unknown as WebGPURenderer;
}

describe('AnimationLoopHold', () => {
  it('hold() stops the loop and covers its start(), and resume() hands start() back and starts the loop once', () => {
    const originalStart = vi.fn();
    const animation = {start: originalStart, stop: vi.fn()};
    const hold = new AnimationLoopHold();

    hold.hold(makeRenderer(animation));

    expect(animation.stop).toHaveBeenCalledTimes(1);
    // as three calls it from render(), compute() and setAnimationLoop() with a callback
    animation.start();
    expect(originalStart, 'a start while held').not.toHaveBeenCalled();
    expect(animation.start, 'covered while held').not.toBe(originalStart);

    hold.resume();

    expect(originalStart, 'resumed').toHaveBeenCalledTimes(1);
    expect(animation.start, 'resumed').toBe(originalStart);

    hold.resume();

    expect(originalStart, 'a second resume()').toHaveBeenCalledTimes(1);
  });

  it('release() hands an own start() back as it was, and starts nothing', () => {
    const originalStart = vi.fn();
    const animation = {start: originalStart, stop: vi.fn()};
    const before = Object.getOwnPropertyDescriptor(animation, 'start');
    const hold = new AnimationLoopHold();
    hold.hold(makeRenderer(animation));

    hold.release();

    expect(Object.getOwnPropertyDescriptor(animation, 'start')).toEqual(before);
    expect(originalStart).not.toHaveBeenCalled();

    hold.release();
    hold.resume();

    expect(originalStart, 'nothing held').not.toHaveBeenCalled();
  });

  it('leaves a loop that carries a callback running, and a renderer without _animation alone', () => {
    const originalStart = vi.fn();
    const animation = {start: originalStart, stop: vi.fn()};
    const hold = new AnimationLoopHold();

    hold.hold(makeRenderer(animation, () => {}));

    expect(animation.stop).not.toHaveBeenCalled();
    expect(animation.start, 'not covered').toBe(originalStart);

    const renderer = makeRenderer(undefined);
    expect(() => hold.hold(renderer)).not.toThrow();
    expect(renderer.getAnimationLoop).not.toHaveBeenCalled();

    hold.resume();

    expect(originalStart, 'nothing held').not.toHaveBeenCalled();
  });
});
