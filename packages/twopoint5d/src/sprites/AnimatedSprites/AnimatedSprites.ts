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

  dispose(): void {
    this.geometry?.dispose();
    this.geometry = undefined;
    this.material?.dispose();
    this.material = undefined;
  }
}
