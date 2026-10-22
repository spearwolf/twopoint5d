import {abs, clamp, float, max, mod, mul, select, sub} from 'three/tsl';
import type {Node} from 'three/webgpu';

/**
 * The frame of an animation at one duration, `steps` frames into it: looped, played once and held,
 * or run back and forth over the frames `0 … lastFrame`. @internal
 */
export function evenFrameOf(params: {
  steps: Node<'float'>;
  frameCount: Node<'float'>;
  lastFrame: Node<'float'>;
  isPingpong: Node<'bool'>;
  isOnce: Node<'bool'>;
}): Node<'int'> {
  const {steps, frameCount, lastFrame, isPingpong, isOnce} = params;
  // 'loop' wraps the steps, 'once' clamps them, 'pingpong' runs a triangle wave over a turn of
  // 2·frameCount − 2 frames, which shows each end frame once: 0 1 2 3 2 1 0 1 … Every branch is an
  // int already: a select() converted to an int afterwards comes out of the WGSL builder as a float
  // in one of the places it is read, and the shader fails to compile.
  // Each branch is clamped to the frames of the animation: the f32 division in mod() may lie several
  // ULP off, floor() then lands on −1 or frameCount, and the shader would read a header texel as tex
  // coords. At that edge a −1 shows the first frame rather than the last — a frame of the animation
  // rather than header data
  const loopFrame = clamp(mod(steps, frameCount).floor(), float(0), lastFrame).toInt();
  const onceFrame = clamp(steps.floor(), float(0), lastFrame).toInt();
  const turnStep = mod(steps, max(sub(mul(frameCount, 2), 2), float(1))).floor();
  const pingpongFrame = clamp(sub(lastFrame, abs(sub(turnStep, lastFrame))), float(0), lastFrame).toInt();
  return select(isPingpong, pingpongFrame, select(isOnce, onceFrame, loopFrame));
}
