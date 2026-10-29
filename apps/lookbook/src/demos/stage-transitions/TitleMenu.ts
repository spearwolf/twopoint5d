import {on} from '@spearwolf/eventize';
import {
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  OrthographicProjection,
  rewriteText,
  Stage2D,
  type StageUpdateFrameProps,
  type TexturedSprite,
  TexturedSpriteKind,
  writeText,
} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';
import {type StageTransitionAssets, VIEW_HEIGHT, VIEW_WIDTH} from './assets';

const PROMPT_COLOR = new Color('#ffd166');
const INFO_COLOR = new Color('#9fb3d9');

/** The title screen: the name of the game in chrome, the big ship, a blinking prompt and a line of settings. */
export class TitleMenu {
  readonly stage = new Stage2D(
    new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'contain'}),
  );
  readonly #assets: StageTransitionAssets;
  readonly #chrome: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #text: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #ships: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #ship: TexturedSprite;
  readonly #prompt: TexturedSprite[];
  #info: TexturedSprite[] = [];

  constructor(assets: StageTransitionAssets) {
    this.#assets = assets;
    this.stage.name = 'title';

    this.#ships = new FeatureSprites(TexturedSpriteKind, {
      capacity: 1,
      textures: {colorMap: assets.shipsTexture},
      transparent: true,
    });
    this.#ship = this.#ships.createSprite()!;
    this.#ship.setFrame(assets.ships.frame('ship-01')!);
    this.#ship.setSize(150, 164);

    this.#chrome = new FeatureSprites(TexturedSpriteKind, {
      capacity: 32,
      textures: {colorMap: assets.chromePage},
      transparent: true,
    });
    this.#text = new FeatureSprites(TexturedSpriteKind, {
      capacity: 160,
      textures: {colorMap: assets.pixelPage},
      transparent: true,
    });
    this.stage.scene.add(this.#ships, this.#chrome, this.#text);

    writeText(this.#chrome, assets.chromeFont, 'STARFALL', {x: 0, y: 140, z: 2, align: 'center', scale: 1.5});
    this.#prompt = writeText(this.#text, assets.pixelFont, 'PRESS ENTER OR CLICK TO START', {
      x: 0,
      y: -98,
      z: 2,
      align: 'center',
      scale: 2,
    });
    for (const glyph of this.#prompt) glyph.setColor(PROMPT_COLOR);
    this.setInfo('');

    on(this.stage, OnStageUpdateFrame, ({now}: StageUpdateFrameProps) => this.#update(now));
  }

  /** The line of settings under the prompt. */
  setInfo(info: string): void {
    this.#info = rewriteText(this.#text, this.#info, this.#assets.pixelFont, info, {
      x: 0,
      y: -130,
      z: 2,
      align: 'center',
      scale: 1,
    });
    for (const glyph of this.#info) glyph.setColor(INFO_COLOR);
    this.#text.update();
  }

  #update(now: number): void {
    this.#ship.setPosition(0, 10 + Math.sin(now * 1.3) * 8, 1);
    this.#ship.rotation = Math.sin(now * 0.7) * 0.06;
    this.#ships.update();
    const alpha = 0.55 + 0.45 * Math.sin(now * 5);
    for (const glyph of this.#prompt) glyph.setColor(PROMPT_COLOR, alpha);
    this.#chrome.update();
    this.#text.update();
  }

  dispose(): void {
    this.#ships.dispose();
    this.#chrome.dispose();
    this.#text.dispose();
    this.stage.dispose();
  }
}
