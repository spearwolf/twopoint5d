import type {Material} from 'three/webgpu';

import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry.js';
import type {AnimatedSpritesMaterial} from './AnimatedSpritesMaterial.js';

export class AnimatedSprites extends VertexObjects<AnimatedSpritesGeometry> {
  declare geometry: AnimatedSpritesGeometry | undefined;
  declare material: AnimatedSpritesMaterial | undefined;

  constructor(geometry?: AnimatedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = 'twopoint5d.AnimatedSprites';
  }

  /**
   * Gives up the geometry and the material. Both were handed to the constructor and belong to
   * the caller, so neither is released here — the caller disposes them.
   *
   * The mesh takes itself out of the scene graph first. Afterwards `geometry` and `material`
   * answer `undefined`. A second call does nothing.
   */
  dispose(): void {
    // a mesh without geometry and material cannot be rendered, so it leaves the
    // scene graph before it gives them up, rather than asking the caller to do it first
    this.removeFromParent();

    this.geometry = undefined;
    this.material = undefined;
  }
}
