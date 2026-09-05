import type {Texture} from 'three/webgpu';
import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {TexturedSprite} from './TexturedSprite.js';
import {
  TexturedSpritesGeometry,
  type TexturedSpriteGeometryParameters,
  type TexturedSpritePool,
} from './TexturedSpritesGeometry.js';
import {TexturedSpritesMaterial, type TexturedSpritesMaterialParameters} from './TexturedSpritesMaterial.js';

const isTexture = (value: Texture | object | undefined): value is Texture => Boolean((value as Texture)?.isTexture);

export class TexturedSprites extends VertexObjects<TexturedSpritesGeometry> {
  declare geometry: TexturedSpritesGeometry | undefined;
  declare material: TexturedSpritesMaterial | undefined;

  #ownsGeometry: boolean;
  #ownsMaterial: boolean;

  /** The sprite pool of the geometry this mesh was built with — `undefined` once disposed. */
  get spritePool(): TexturedSpritePool | undefined {
    return this.geometry?.instancedPool;
  }

  /** The color map of the material of this mesh — `undefined` once disposed. */
  get texture(): Texture | undefined {
    return this.material?.colorMap;
  }

  /** Sets the color map of the material. Does nothing once the sprites have been disposed. */
  set texture(texture: Texture | undefined) {
    if (this.material != null) {
      this.material.colorMap = texture;
    }
  }

  constructor(
    geometry?: number | TexturedSpritesGeometry | TexturedSpriteGeometryParameters,
    material?: Texture | TexturedSpritesMaterial | TexturedSpritesMaterialParameters,
  ) {
    super(
      geometry instanceof TexturedSpritesGeometry ? geometry : new TexturedSpritesGeometry(geometry),
      material instanceof TexturedSpritesMaterial
        ? material
        : isTexture(material)
          ? new TexturedSpritesMaterial({colorMap: material})
          : new TexturedSpritesMaterial(material),
    );

    // only the geometry and the material built right here belong to this mesh; a texture
    // handed in as `material` stays the caller's, the material wrapped around it does not
    this.#ownsGeometry = !(geometry instanceof TexturedSpritesGeometry);
    this.#ownsMaterial = !(material instanceof TexturedSpritesMaterial);

    this.name = 'twopoint5d.TexturedSprites';
  }

  /**
   * Takes a sprite from the sprite pool. Answers `undefined` once the pool has reached its
   * capacity or the sprites have been disposed.
   */
  createSprite(): TexturedSprite | undefined {
    return this.geometry?.instancedPool.createVO();
  }

  /**
   * Gives a sprite back to the sprite pool. Does nothing once the sprites have been disposed.
   */
  freeSprite(sprite: TexturedSprite): void {
    this.geometry?.instancedPool.freeVO(sprite);
  }

  /**
   * Releases the geometry and the material that this mesh built for itself. A
   * `TexturedSpritesGeometry` or a `TexturedSpritesMaterial` handed to the constructor belongs
   * to the caller and is left untouched, and so is a `Texture` passed as the material argument.
   *
   * The mesh takes itself out of the scene graph first. Afterwards `geometry`, `material`,
   * {@link spritePool} and {@link texture} answer `undefined`, {@link createSprite} answers
   * `undefined` and {@link freeSprite} does nothing. A second call does nothing.
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
