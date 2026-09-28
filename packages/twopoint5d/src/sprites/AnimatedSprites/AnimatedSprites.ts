import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {AnimatedSprite} from './AnimatedSprite.js';
import {
  AnimatedSpritesGeometry,
  type AnimatedSpritesGeometryParameters,
  type AnimatedSpritesPool,
} from './AnimatedSpritesGeometry.js';
import {AnimatedSpritesMaterial, type AnimatedSpritesMaterialParameters} from './AnimatedSpritesMaterial.js';

/**
 * The mesh that draws animated sprites, one instance of its `AnimatedSpritesGeometry` per sprite.
 *
 * It takes a capacity, `AnimatedSpritesGeometryParameters` or an `AnimatedSpritesGeometry`, and
 * `AnimatedSpritesMaterialParameters` or an `AnimatedSpritesMaterial`, and builds what it is not
 * handed. What it builds belongs to it and goes with {@link dispose}; a geometry or a material
 * handed in stays the caller's.
 *
 * By default position and rotation of the sprites are dynamic attributes and go up to the gpu
 * with every `update()`, and the others are static — see the setters of {@link AnimatedSprite} for how
 * a later change of them reaches the gpu. The `attributeUsage` of `AnimatedSpritesGeometryParameters` gives any of
 * them another usage, position and rotation a static one included.
 */
export class AnimatedSprites extends VertexObjects<AnimatedSpritesGeometry> {
  declare geometry: AnimatedSpritesGeometry | undefined;
  declare material: AnimatedSpritesMaterial | undefined;

  #ownsGeometry: boolean;
  #ownsMaterial: boolean;

  /** The sprite pool of the geometry this mesh was built with — `undefined` once disposed. */
  get spritePool(): AnimatedSpritesPool | undefined {
    return this.geometry?.instancedPool;
  }

  /**
   * @param material an `AnimatedSpritesMaterial`, or the parameters the mesh builds one from. Every
   *   field of the parameters is optional, so another three.js `Material` or a `Texture` would pass
   *   for them; the `isMaterial` and the `isTexture` they carry keep them out.
   */
  constructor(
    geometry?: number | AnimatedSpritesGeometry | AnimatedSpritesGeometryParameters,
    material?: AnimatedSpritesMaterial | (AnimatedSpritesMaterialParameters & {isMaterial?: never; isTexture?: never}),
  ) {
    super(
      geometry instanceof AnimatedSpritesGeometry ? geometry : new AnimatedSpritesGeometry(geometry),
      material instanceof AnimatedSpritesMaterial ? material : new AnimatedSpritesMaterial(material),
    );

    // only the geometry and the material built right here belong to this mesh
    this.#ownsGeometry = !(geometry instanceof AnimatedSpritesGeometry);
    this.#ownsMaterial = !(material instanceof AnimatedSpritesMaterial);

    this.name = 'twopoint5d.AnimatedSprites';
  }

  /**
   * Takes a sprite from the sprite pool. Answers `undefined` once the pool has reached its
   * capacity or the sprites have been disposed.
   *
   * The sprite starts with its size, `animId`, `animOffset`, position and rotation at 0, whatever
   * the sprite that stood in its slot before carried.
   */
  createSprite(): AnimatedSprite | undefined {
    return this.geometry?.instancedPool.createVO();
  }

  /**
   * Gives a sprite back to the sprite pool. Does nothing once the sprites have been disposed.
   */
  freeSprite(sprite: AnimatedSprite): void {
    this.geometry?.instancedPool.freeVO(sprite);
  }

  /**
   * Releases the geometry and the material that this mesh built for itself. An
   * `AnimatedSpritesGeometry` or an `AnimatedSpritesMaterial` handed to the constructor belongs
   * to the caller and is left untouched.
   *
   * The mesh takes itself out of the scene graph first. Afterwards `geometry`, `material` and
   * {@link spritePool} answer `undefined`, {@link createSprite} answers `undefined` and
   * {@link freeSprite} does nothing. A second call does nothing.
   */
  dispose(): void {
    // a mesh without geometry and material cannot be rendered, so it leaves the
    // scene graph before it gives them up, rather than asking the caller to do it first
    this.removeFromParent();

    if (this.#ownsGeometry) {
      this.geometry?.dispose();
    }
    this.geometry = undefined;

    if (this.#ownsMaterial) {
      this.material?.dispose();
    }
    this.material = undefined;
  }
}
