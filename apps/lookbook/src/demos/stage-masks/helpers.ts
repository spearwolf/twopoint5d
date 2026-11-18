import type {TextureAtlasFrame, TextureCoords, TexturedSprite} from '@spearwolf/twopoint5d';
import {dot, fract, vec3} from 'three/tsl';
import {
  type BufferAttribute,
  type BufferGeometry,
  CustomBlending,
  DstColorFactor,
  type InterleavedBufferAttribute,
  type MeshBasicNodeMaterial,
  type Node,
  OneFactor,
  ZeroFactor,
} from 'three/webgpu';

// The helpers that every demo needs — the seeded random, the named atlas frame, the loading and
// checking of the files — lie under `~demos/utils/`. This module holds what the scenes of the
// stage mask demos share among themselves. A scene imports from it, from `SoftBlobs.ts` (a
// building block, not a scene) and from the modules of its own demo page, never from the module
// of another demo: a scene that someone takes as a template brings nothing foreign with it.

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

/** Puts `frame` on `sprite`, mirrored left to right: the tex coords start at its right edge and run back. */
export function setMirroredFrame(sprite: TexturedSprite, frame: TextureAtlasFrame): void {
  sprite.setFrame(frame);
  const [s, t, u, v] = frame.coords.getTexCoords();
  sprite.setTexCoords(s + u, t, -u, v);
}

/** the uv of each plane as the plane built it, copied at the first call that maps it */
const builtUv = new WeakMap<BufferAttribute | InterleavedBufferAttribute, Float32Array>();

/**
 * Writes the `uv` of a `PlaneGeometry` — of any number of segments, as the plane built it, 0 … 1
 * over the plane — so that the plane shows `coords` upright. The plane counts v up from its bottom
 * edge; the atlas is read with `flipY = false` and counts t down from the top of the image, so the
 * top of the plane gets the top of the frame. A second call — the next frame of an animation —
 * maps from the uv the plane was built with, not from the one the call before wrote.
 */
export function setPlaneUvToFrame(geometry: BufferGeometry, coords: TextureCoords): void {
  const [s, t, u, v] = coords.getTexCoords();
  const uv = geometry.getAttribute('uv');
  // keyed by the attribute, not by the geometry: a uv attribute put in its place gets a copy of its own
  let built = builtUv.get(uv);
  if (!built) {
    built = new Float32Array(uv.count * 2);
    for (let i = 0; i < uv.count; i++) {
      built[2 * i] = uv.getX(i);
      built[2 * i + 1] = uv.getY(i);
    }
    builtUv.set(uv, built);
  }
  for (let i = 0; i < uv.count; i++) uv.setXY(i, s + built[2 * i]! * u, t + (1 - built[2 * i + 1]!) * v);
  uv.needsUpdate = true;
}
