import {FeatureSprites, type FeatureSpritesOf, type TexturedSprite, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import {type Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, type Texture} from 'three/webgpu';

/**
 * One soft blob of a {@link SoftBlobs} pool: a radial falloff from full coverage in the middle to
 * none at `radius`. Write the fields freely; {@link SoftBlobs.update} hands them to the GPU.
 */
export class SoftBlob {
  x = 0;
  y = 0;
  /** where the blob fades to nothing, in units of the stage */
  radius = 64;
  /** the alpha of the middle, 0 to 1: the coverage the blob gives under `source: 'alpha'` */
  intensity = 1;
  /** the linear color of the blob: what `'red'`, `'green'`, `'blue'` and `'luminance'` read */
  r = 1;
  g = 1;
  b = 1;
  /** `false` keeps the blob in the pool but draws nothing */
  visible = true;

  /** @internal the sprite that draws the blob */
  readonly sprite: TexturedSprite;

  /** @internal made by {@link SoftBlobs.add} */
  constructor(sprite: TexturedSprite) {
    this.sprite = sprite;
  }

  /** Copies the linear rgb of a three.js `Color`. */
  setColor(color: Color): this {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
}

export interface SoftBlobsOptions {
  /** how many blobs the pool holds at most */
  capacity: number;
  /** the name of the sprite mesh, for the three.js inspector */
  name?: string;
  /**
   * The shape of the falloff from the middle (`t = 0`) to the rim (`t = 1`), answering the alpha
   * from 1 to 0. Default: `(1 − t²)³`, smooth in the middle and at the rim, no visible edge.
   */
  falloff?: (t: number) => number;
  /** the edge length of the generated falloff texture in texels, default 128 */
  textureSize?: number;
}

const defaultFalloff = (t: number) => (1 - t * t) ** 3;

/**
 * Makes the radial falloff as a texture: white, the falloff in the alpha. Alpha is all a mask stage
 * needs; the rgb of a blob comes from its tint. Written into a typed array, so it needs no canvas
 * and is the same on every machine.
 */
function makeFalloffTexture(size: number, falloff: (t: number) => number): Texture {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // texel centres, so the falloff is symmetric and the outermost ring is 0
      const t = Math.min(1, Math.hypot(x + 0.5 - half, y + 0.5 - half) / half);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, falloff(t))));
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A pool of soft radial blobs for a mask stage: candle glows, the light around a player, the reach
 * of torches, a fog that thins out. One `FeatureSprites` mesh of `TexturedSpriteKind` draws all of
 * them over transparent black, so their alpha (and their premultiplied rgb) is the coverage a
 * `StageMask` or `createMaskNode()` reads. Overlapping blobs combine as `over`:
 * `1 − (1 − a)(1 − b)`, never above 1.
 *
 * Add the mesh to the scene of the mask stage, move the blobs, call {@link update} once per frame.
 * Neither {@link update} nor moving a blob allocates.
 */
export class SoftBlobs {
  readonly mesh: FeatureSpritesOf<typeof TexturedSpriteKind>;
  /** the generated falloff texture; the pool owns it */
  readonly texture: Texture;
  readonly #blobs: SoftBlob[] = [];

  constructor({capacity, name = 'soft blobs', falloff = defaultFalloff, textureSize = 128}: SoftBlobsOptions) {
    this.texture = makeFalloffTexture(textureSize, falloff);
    this.mesh = new FeatureSprites(TexturedSpriteKind, {
      capacity,
      textures: {colorMap: this.texture},
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // a blob changes its size and its glow every frame
      attributeUsage: {dynamic: ['size', 'color']},
    });
    this.mesh.name = name;
  }

  /** The blobs in the order they were added: the later ones draw on top. */
  get blobs(): readonly SoftBlob[] {
    return this.#blobs;
  }

  /** A new blob, or `undefined` once the pool is full. */
  add(x = 0, y = 0, radius = 64, intensity = 1): SoftBlob | undefined {
    const sprite = this.mesh.createSprite();
    if (!sprite) return undefined;
    sprite.setTexCoords(0, 0, 1, 1);
    const blob = new SoftBlob(sprite);
    blob.x = x;
    blob.y = y;
    blob.radius = radius;
    blob.intensity = intensity;
    this.#blobs.push(blob);
    this.#write(blob);
    return blob;
  }

  /** Takes a blob out of the pool; its sprite goes back to the mesh. */
  remove(blob: SoftBlob): void {
    const index = this.#blobs.indexOf(blob);
    if (index < 0) return;
    this.#blobs.splice(index, 1);
    this.mesh.freeSprite(blob.sprite);
  }

  #write(blob: SoftBlob): void {
    const {sprite} = blob;
    const diameter = blob.visible ? blob.radius * 2 : 0;
    sprite.setPosition(blob.x, blob.y, 0);
    sprite.setSize(diameter, diameter);
    sprite.setColorValues(blob.r, blob.g, blob.b, Math.max(0, Math.min(1, blob.intensity)));
  }

  /** Writes every blob to its sprite and uploads them: once per frame, after moving the blobs. */
  update(): void {
    const blobs = this.#blobs;
    for (let i = 0; i < blobs.length; i++) this.#write(blobs[i]!);
    this.mesh.update();
  }

  dispose(): void {
    this.#blobs.length = 0;
    this.mesh.dispose();
    this.texture.dispose();
  }
}
