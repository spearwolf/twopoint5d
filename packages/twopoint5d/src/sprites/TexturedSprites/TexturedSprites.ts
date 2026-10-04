import type {Texture} from 'three/webgpu';
import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {TexturedSprite} from './TexturedSprite.js';
import {
  TexturedSpritesGeometry,
  type TexturedSpritesGeometryParameters,
  type TexturedSpritesPool,
} from './TexturedSpritesGeometry.js';
import {TexturedSpritesMaterial, type TexturedSpritesMaterialParameters} from './TexturedSpritesMaterial.js';

const isTexture = (value: Texture | object | undefined): value is Texture => Boolean((value as Texture)?.isTexture);

/**
 * The mesh that draws textured sprites, one instance of its `TexturedSpritesGeometry` per sprite.
 *
 * It takes a capacity, `TexturedSpritesGeometryParameters` or a `TexturedSpritesGeometry`, and a
 * `Texture`, `TexturedSpritesMaterialParameters` or a `TexturedSpritesMaterial`, and builds what it
 * is not handed. What it builds belongs to it and goes with {@link dispose}; a geometry, a material
 * or a texture handed in stays the caller's.
 *
 * By default position and rotation of the sprites are dynamic attributes and go up to the gpu
 * with every `update()`, and the others are static — see the setters of {@link TexturedSprite} for how
 * a later change of them reaches the gpu. The `attributeUsage` of `TexturedSpritesGeometryParameters` gives any of
 * them another usage, position and rotation a static one included.
 */
export class TexturedSprites extends VertexObjects<TexturedSpritesGeometry> {
  declare geometry: TexturedSpritesGeometry | undefined;
  declare material: TexturedSpritesMaterial | undefined;

  #ownsGeometry: boolean;
  #ownsMaterial: boolean;
  #disposed = false;

  /** The sprite pool of the geometry this mesh was built with — `undefined` once disposed. */
  get spritePool(): TexturedSpritesPool | undefined {
    return this.geometry?.instancedPool;
  }

  /** The color map of the material of this mesh — `undefined` once disposed. */
  get texture(): Texture | undefined {
    return this.material?.colorMap;
  }

  /**
   * Sets the color map of the material. Does nothing once the sprites have been disposed.
   *
   * Which change of the texture costs a rebuild of the shader graph and which does not is told at
   * {@link TexturedSpritesMaterial.colorMap}.
   */
  set texture(texture: Texture | undefined) {
    if (this.material != null) {
      this.material.colorMap = texture;
    }
  }

  /**
   * @param material a `TexturedSpritesMaterial`, a `Texture` the mesh builds one around, or the
   *   parameters it builds one from. Every field of the parameters is optional, so another three.js
   *   `Material` would pass for them; the `isMaterial` it carries keeps it out. A `Texture` takes the
   *   branch of its own.
   */
  constructor(
    geometry?: number | TexturedSpritesGeometry | TexturedSpritesGeometryParameters,
    material?: Texture | TexturedSpritesMaterial | (TexturedSpritesMaterialParameters & {isMaterial?: never; isTexture?: never}),
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
   *
   * The sprite starts with its size, tex coords, `texFlipDiagonal`, trim margins, position and
   * rotation at 0, and white as its color, whatever the sprite that stood in its slot before carried.
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
   * `undefined` and {@link freeSprite} does nothing. Like `Object3D.dispose()` it fires three's
   * `dispose` event, so the renderer drops what it built for this mesh. A second call does
   * nothing.
   */
  override dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // a mesh without geometry and material cannot be rendered, so it leaves the
    // scene graph before it gives them up, rather than asking the caller to do it first
    this.removeFromParent();

    // three's dispose event: the renderer drops what it built for this mesh, which a geometry
    // or a material handed in and left alive below would otherwise keep in its caches
    super.dispose();

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
