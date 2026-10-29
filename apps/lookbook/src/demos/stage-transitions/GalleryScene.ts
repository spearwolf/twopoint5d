import {on} from '@spearwolf/eventize';
import {
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  type StageUpdateFrameProps,
  type TexturedSprite,
  TexturedSpriteKind,
  writeText,
} from '@spearwolf/twopoint5d';
import {CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, type Texture} from 'three/webgpu';
import {type StageTransitionAssets, VIEW_HEIGHT, VIEW_WIDTH} from './assets';

export interface GallerySceneLook {
  name: string;
  /** Paints one tile of the background, 64 × 64 pixels. */
  paint: (ctx: CanvasRenderingContext2D) => void;
  letter: string;
  ship: string;
  /** Which way the ships drift: +1 to the right, -1 to the left. */
  drift: number;
}

function patternTexture(paint: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  paint(canvas.getContext('2d')!);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(VIEW_WIDTH / 32, VIEW_HEIGHT / 32);
  return texture;
}

export const WARM: GallerySceneLook = {
  name: 'A',
  paint: (ctx) => {
    ctx.fillStyle = '#ff7b3a';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#c2304a';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);
  },
  letter: 'A',
  ship: 'ship-01',
  drift: 1,
};

export const COLD: GallerySceneLook = {
  name: 'B',
  paint: (ctx) => {
    ctx.fillStyle = '#1d3b8f';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#3fd0c9';
    ctx.lineWidth = 12;
    for (let i = -64; i <= 128; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 64, 64);
      ctx.stroke();
    }
  },
  letter: 'B',
  ship: 'ship-02',
  drift: -1,
};

/** One of the two pictures the gallery turns into each other: a pattern, a big letter and ships drifting past. */
export class GalleryScene {
  readonly stage = new Stage2D(
    new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}),
  );
  readonly #pattern: Texture;
  readonly #geometry = new PlaneGeometry(VIEW_WIDTH * 2, VIEW_HEIGHT * 2);
  readonly #material: MeshBasicMaterial;
  readonly #chrome: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #ships: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #fleet: {sprite: TexturedSprite; x: number; y: number; speed: number}[] = [];
  readonly #drift: number;

  constructor(assets: StageTransitionAssets, look: GallerySceneLook) {
    this.stage.name = look.name;
    this.#drift = look.drift;
    this.#pattern = patternTexture(look.paint);
    // twice the view, so the pattern still covers it under `cover` on a wide screen
    this.#pattern.repeat.multiplyScalar(2);
    this.#material = new MeshBasicMaterial({map: this.#pattern});
    this.stage.scene.add(new Mesh(this.#geometry, this.#material));

    this.#chrome = new FeatureSprites(TexturedSpriteKind, {
      capacity: 4,
      textures: {colorMap: assets.chromePage},
      transparent: true,
    });
    writeText(this.#chrome, assets.chromeFont, look.letter, {x: 0, y: 120, z: 2, align: 'center', scale: 4});
    this.#chrome.update();

    this.#ships = new FeatureSprites(TexturedSpriteKind, {
      capacity: 5,
      textures: {colorMap: assets.shipsTexture},
      transparent: true,
    });
    const frame = assets.ships.frame(look.ship)!;
    for (let i = 0; i < 5; i++) {
      const sprite = this.#ships.createSprite()!;
      sprite.setFrame(frame);
      sprite.setSize(64, 64);
      sprite.rotation = -look.drift * Math.PI * 0.5;
      this.#fleet.push({sprite, x: (i / 5) * VIEW_WIDTH - VIEW_WIDTH / 2, y: -140 + (i % 2) * 40, speed: 60 + i * 15});
    }
    this.stage.scene.add(this.#chrome, this.#ships);

    on(this.stage, OnStageUpdateFrame, ({deltaTime, now}: StageUpdateFrameProps) => {
      for (const ship of this.#fleet) {
        ship.x += ship.speed * this.#drift * deltaTime;
        if (ship.x > VIEW_WIDTH / 2 + 60) ship.x -= VIEW_WIDTH + 120;
        if (ship.x < -VIEW_WIDTH / 2 - 60) ship.x += VIEW_WIDTH + 120;
        ship.sprite.setPosition(ship.x, ship.y + Math.sin(now * 2 + ship.speed) * 6, 1);
      }
      this.#ships.update();
    });
  }

  dispose(): void {
    this.#chrome.dispose();
    this.#ships.dispose();
    this.#geometry.dispose();
    this.#material.dispose();
    this.#pattern.dispose();
    this.stage.dispose();
  }
}
