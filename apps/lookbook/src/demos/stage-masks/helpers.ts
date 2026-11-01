import {dot, fract, vec3} from 'three/tsl';
import {CustomBlending, DstColorFactor, type MeshBasicNodeMaterial, type Node, OneFactor, ZeroFactor} from 'three/webgpu';

/**
 * The helpers the scenes of the stage mask demos have in common. A scene imports from this
 * module, from `SoftBlobs.ts` (a building block, not a scene) and from the modules of its own demo
 * page, never from the module of another demo: a scene that someone takes as a template brings
 * nothing foreign with it.
 */

/** the step of the state of the generator */
const STEP = 0x6d2b79f5;

/** the mix of the state of the generator, as a value in [0, 1) */
function mix32(state: number): number {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A small seeded generator (a 32-bit mulberry): a seeded scene lays out and flickers the same on every run. */
export class SeededRandom {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /** The next value, in [0, 1). */
  next(): number {
    this.#state = (this.#state + STEP) >>> 0;
    return mix32(this.#state);
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

/**
 * The value that the `index`-th call of `next()` of a `new SeededRandom(seed)` returns, counted
 * from 0, without the calls before it: a random that hangs on a time step
 * (`Math.floor(time * rate)`) and not on the frame, so every frame rate draws the same values at
 * the same time.
 */
export const randomAt = (seed: number, index: number): number => mix32(((seed >>> 0) + Math.imul(index + 1, STEP)) >>> 0);

/** smoothstep on the CPU, with the formula of GLSL and WGSL; `e0 < e1`. */
export function smoothstepCpu(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * A hash in 0 … 1 of a 2D cell, without `sin()` (Dave Hoskins' "hash without sine"): a `sin()` of
 * large screen coordinates leaves diagonal stripes in the grain on some GPUs.
 */
export const hash21 = (p: Node<'vec2'>): Node<'float'> => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031));
  const q = p3.add(dot(p3, p3.yzx.add(33.33)));
  return fract(q.x.add(q.y).mul(q.z));
};

/** Multiplies what lies below by its rgb and leaves the alpha alone: the camera's light falloff. */
export function multiply(material: MeshBasicNodeMaterial): MeshBasicNodeMaterial {
  material.transparent = true;
  material.blending = CustomBlending;
  material.blendSrc = DstColorFactor;
  material.blendDst = ZeroFactor;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}

/** Adds its rgb as light and leaves the alpha alone. */
export function additive(material: MeshBasicNodeMaterial): MeshBasicNodeMaterial {
  material.transparent = true;
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneFactor;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}
