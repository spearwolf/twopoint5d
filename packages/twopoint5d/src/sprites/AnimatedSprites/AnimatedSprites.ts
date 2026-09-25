import type {BufferGeometry, MeshBasicMaterial} from 'three/webgpu';

import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry.js';
import type {AnimatedSpritesMaterial} from './AnimatedSpritesMaterial.js';

/**
 * The mesh that draws animated sprites, one instance of its `AnimatedSpritesGeometry` per sprite.
 *
 * `GeoType` is the geometry the mesh holds. Built without one, the mesh holds the plain
 * `BufferGeometry` that `THREE.Mesh` puts in its place — `GeoType` is then `BufferGeometry`. A
 * type argument named explicitly while the geometry is left out states a geometry the mesh does
 * not hold.
 */
export class AnimatedSprites<
  GeoType extends AnimatedSpritesGeometry | BufferGeometry = BufferGeometry,
> extends VertexObjects<GeoType> {
  // built without a material, the mesh holds the MeshBasicMaterial THREE.Mesh puts in its place
  declare material: AnimatedSpritesMaterial | MeshBasicMaterial | undefined;

  constructor(geometry?: GeoType, material?: AnimatedSpritesMaterial) {
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
