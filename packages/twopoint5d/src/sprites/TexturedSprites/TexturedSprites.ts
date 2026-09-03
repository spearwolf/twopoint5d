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

  /** The sprite pool of the geometry this mesh was built with — `undefined` once disposed. */
  get spritePool(): TexturedSpritePool | undefined {
    return this.geometry?.instancedPool;
  }

  get texture(): Texture | undefined {
    return this.material?.colorMap;
  }

  set texture(texture: Texture | undefined) {
    if (this.material != null) {
      this.material.colorMap = texture;
    }
  }

  constructor(
    geometry?: number | TexturedSpritesGeometry | TexturedSpriteGeometryParameters,
    material: Texture | TexturedSpritesMaterial | TexturedSpritesMaterialParameters = new TexturedSpritesMaterial(),
  ) {
    super(
      geometry instanceof TexturedSpritesGeometry ? geometry : new TexturedSpritesGeometry(geometry),
      isTexture(material)
        ? new TexturedSpritesMaterial({colorMap: material})
        : material instanceof TexturedSpritesMaterial
          ? material
          : new TexturedSpritesMaterial(material),
    );

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

  dispose(): void {
    this.geometry?.dispose();
    this.geometry = undefined;
    this.material?.dispose();
    this.material = undefined;
  }
}
