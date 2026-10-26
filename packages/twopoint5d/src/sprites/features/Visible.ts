import {mul, step} from 'three/tsl';
import {defineFeature, MeshOrder} from '../SpriteFeature.js';

export interface VisibleApi {
  /**
   * Whether the sprite is drawn: 1, what a new sprite starts with, draws it, 0 hides it; a value of
   * 0.5 and above counts as 1. A hidden sprite keeps every other value of its own — size, frame,
   * color — and is drawn as it was once it is shown again. It is hidden in every pass and never
   * picked, and its vertices still run through the vertex shader.
   *
   * `visible` is a static attribute: a later change reaches the gpu once it is marked —
   * `spritePool.touchVO(sprite, 'visible')` — or with every `update()` in a geometry built with
   * `attributeUsage: {dynamic: ['visible']}`.
   */
  visible: number;
}

/**
 * Shows and hides the sprite by its `visible` attribute, in a mesh stage at `MeshOrder.Hide`, the last
 * band: a hidden sprite moves every vertex onto the origin of the mesh, so its triangles have no area
 * and draw no fragment. The materials of its passes and of a `SpritePicker` run the stage after their
 * own, and hide it alike.
 */
export const Visible = defineFeature<VisibleApi>({
  name: 'visible',
  attributes: {visible: {size: 1}},
  initialize() {
    this.visible = 1;
  },
  mesh: {
    order: MeshOrder.Hide,
    // 0 or 1, whatever was written: a hidden sprite is never drawn shrunk
    transform: (position, {attribute}) => mul(position, step(0.5, attribute<'float'>('visible'))),
  },
});
