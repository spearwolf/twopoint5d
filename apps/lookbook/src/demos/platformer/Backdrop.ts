import {
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  type SpriteOf,
  type TextureAtlas,
  TextureColor,
  TexturedSpriteKind,
  type FeatureSpritesOf,
} from '@spearwolf/twopoint5d';
import {Group, type Texture} from 'three/webgpu';

// no frame feature: a layer sprite shows its whole texture
const LayerKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TextureColor]});

type LayerSprite = SpriteOf<typeof LayerKind>;

const LAYER_WIDTH = 512;
const LAYER_HEIGHT = 216;
// side by side, enough copies for a window 4096 art pixels wide
const LAYER_COPIES = 8;
const TILE = 16;

interface Layer {
  sprites: FeatureSpritesOf<typeof LayerKind>;
  copies: LayerSprite[];
  /** How far the layer moves with the camera: 0 stands still on the screen, 1 moves with the floor. */
  scroll: number;
}

export interface BackdropTextures {
  sky: Texture;
  mountains: Texture;
  machines: Texture;
  tiles: {atlas: TextureAtlas; colorMap: Texture};
}

/**
 * The Turrican-style backdrop: three parallax layers — sky, alien crags, a machine city — and the
 * tech floor the fight takes place on, with lamps and crates behind the fighters. All of it is
 * pixel art at native resolution, the camera scales it by a whole number.
 */
export class Backdrop extends Group {
  readonly #layers: Layer[];
  readonly #tiles: FeatureSpritesOf<typeof TexturedSpriteKind>;

  /**
   * @param minX, maxX — the arena, in art pixels; the floor runs this far and a little beyond
   * @param layerBottom — where the bottom edge of the parallax layers sits, the floor top at 0
   */
  constructor({sky, mountains, machines, tiles}: BackdropTextures, minX: number, maxX: number, layerBottom: number) {
    super();
    this.name = 'backdrop';

    this.#layers = [
      {texture: sky, scroll: 0.05},
      {texture: mountains, scroll: 0.25},
      {texture: machines, scroll: 0.5},
    ].map(({texture, scroll}, i) => {
      const sprites = new FeatureSprites(LayerKind, {capacity: LAYER_COPIES, textures: {colorMap: texture}});
      sprites.name = `layer-${i}`;
      // back to front
      sprites.position.z = -30 + i;
      const copies: LayerSprite[] = [];
      for (let c = 0; c < LAYER_COPIES; c++) {
        const sprite = sprites.createSprite()!;
        sprite.setSize(LAYER_WIDTH, LAYER_HEIGHT);
        sprite.setPosition(0, layerBottom + LAYER_HEIGHT / 2);
        copies.push(sprite);
      }
      this.add(sprites);
      return {sprites, copies, scroll};
    });

    this.#tiles = this.#buildFloor(tiles, minX, maxX);
    this.add(this.#tiles);
  }

  #buildFloor({atlas, colorMap}: BackdropTextures['tiles'], minX: number, maxX: number) {
    const tiles = new FeatureSprites(TexturedSpriteKind, {capacity: 1024, textures: {colorMap}});
    tiles.name = 'floor';
    tiles.position.z = -10;

    const put = (frameName: string, left: number, bottom: number, shade = 1) => {
      const frame = atlas.frame(frameName)!;
      const {width, height} = frame.coords;
      const tile = tiles.createSprite()!;
      tile.setSize(width, height);
      tile.setFrame(frame);
      // the sprite stands on its middle: from the bottom left corner to there
      tile.setPosition(left + width / 2, bottom + height / 2);
      tile.setColorValues(shade, shade, shade, 1);
    };

    // the floor: the walkable top at y = 0, three rows of fill below, a screen beyond each end
    const from = Math.floor(minX / TILE) * TILE - 512;
    const to = Math.ceil(maxX / TILE) * TILE + 512;
    for (let x = from; x < to; x += TILE) {
      put('ground-top', x, -TILE);
      for (let row = 2; row <= 4; row++) put('ground', x, -TILE * row);
    }

    // a girder bridge in the back, lamps along the floor, crates stacked at both ends of the arena
    const back = 0.62;
    for (let x = minX + 96; x < maxX - 96; x += 192) put('lamp', x, 0, 0.9);
    for (const [left, length] of [
      [minX + 150, 6],
      [maxX - 330, 8],
    ] as const) {
      put('platform-left', left, 56, back);
      for (let i = 1; i < length - 1; i++) put('platform', left + i * TILE, 56, back);
      put('platform-right', left + (length - 1) * TILE, 56, back);
      for (const pillar of [left + TILE, left + (length - 2) * TILE]) {
        for (let y = 0; y < 56; y += TILE) put('girder', pillar, y, back);
      }
    }
    for (const [x, height] of [
      [minX, 4],
      [minX + TILE, 2],
      [minX + 2 * TILE, 1],
      [maxX - TILE, 4],
      [maxX - 2 * TILE, 2],
      [maxX - 3 * TILE, 1],
      [-40, 1],
      [-24, 1],
      [-32, 2],
    ] as const) {
      for (let i = 0; i < height; i++) put('crate', x, i * TILE, 0.8);
    }

    tiles.update();
    return tiles;
  }

  /** Moves each layer by its share of the camera, whole pixels only, its copies side by side. */
  update(cameraX: number, viewWidth: number): void {
    for (const {sprites, copies, scroll} of this.#layers) {
      // a point u of the layer shows at x = u + cameraX · (1 − scroll)
      const shift = Math.round(cameraX * (1 - scroll));
      const first = Math.floor((cameraX * scroll - viewWidth / 2) / LAYER_WIDTH);
      for (let c = 0; c < copies.length; c++) {
        copies[c]!.x = shift + (first + c) * LAYER_WIDTH + LAYER_WIDTH / 2;
      }
      sprites.update();
    }
  }

  override dispose(): void {
    for (const {sprites} of this.#layers) sprites.dispose();
    this.#tiles.dispose();
    this.removeFromParent();
  }
}
