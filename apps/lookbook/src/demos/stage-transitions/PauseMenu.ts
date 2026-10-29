import {
  FeatureSprites,
  type FeatureSpritesOf,
  OrthographicProjection,
  Stage2D,
  TexturedSpriteKind,
  writeText,
} from '@spearwolf/twopoint5d';
import {Color, Mesh, MeshBasicMaterial, PlaneGeometry} from 'three/webgpu';
import {type StageTransitionAssets, VIEW_HEIGHT, VIEW_WIDTH} from './assets';

/** The pause menu: a dimmed veil over the whole picture, "PAUSED" and the keys. */
export class PauseMenu {
  readonly stage = new Stage2D(
    new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'contain'}),
  );
  readonly #geometry = new PlaneGeometry(VIEW_WIDTH * 4, VIEW_HEIGHT * 4);
  readonly #material = new MeshBasicMaterial({color: new Color('#05060d'), transparent: true, opacity: 0.65, depthWrite: false});
  readonly #chrome: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #text: FeatureSpritesOf<typeof TexturedSpriteKind>;

  constructor(assets: StageTransitionAssets) {
    this.stage.name = 'pause';
    this.stage.scene.add(new Mesh(this.#geometry, this.#material));

    this.#chrome = new FeatureSprites(TexturedSpriteKind, {
      capacity: 16,
      textures: {colorMap: assets.chromePage},
      transparent: true,
    });
    this.#text = new FeatureSprites(TexturedSpriteKind, {
      capacity: 96,
      textures: {colorMap: assets.pixelPage},
      transparent: true,
    });
    this.stage.scene.add(this.#chrome, this.#text);

    writeText(this.#chrome, assets.chromeFont, 'PAUSED', {x: 0, y: 60, z: 1, align: 'center', scale: 1.25});
    const keys = writeText(this.#text, assets.pixelFont, 'ESC  RESUME\n\nQ  QUIT TO TITLE', {
      x: 0,
      y: -10,
      z: 1,
      align: 'center',
      scale: 2,
    });
    for (const glyph of keys) glyph.setColor(new Color('#ffd166'));
    this.#chrome.update();
    this.#text.update();
  }

  dispose(): void {
    this.#chrome.dispose();
    this.#text.dispose();
    this.#geometry.dispose();
    this.#material.dispose();
    this.stage.dispose();
  }
}
