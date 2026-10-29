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
} from '@spearwolf/twopoint5d';
import {Color, type Texture} from 'three/webgpu';
import {VIEW_HEIGHT, VIEW_WIDTH} from './assets';

const COUNT = 360;
// wider than the view: under `cover` a wide window shows more of it
const SPREAD_X = VIEW_WIDTH * 1.2;
const SPREAD_Y = VIEW_HEIGHT * 1.2;

interface Star {
  sprite: TexturedSprite;
  depth: number;
  x: number;
  y: number;
}

/**
 * Stars falling past at three depths: the bottom layer of the stack, from the title to the game and
 * back. `warp` is how fast they fall; the demos ease it when the game starts.
 */
export class Starfield {
  readonly stage = new Stage2D(
    new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}),
  );
  readonly #sprites: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #stars: Star[] = [];

  warp = 1;
  targetWarp = 1;

  constructor(dot: Texture) {
    this.stage.name = 'stars';
    this.#sprites = new FeatureSprites(TexturedSpriteKind, {
      capacity: COUNT,
      textures: {colorMap: dot},
      transparent: true,
      depthWrite: false,
    });
    this.stage.scene.add(this.#sprites);

    const tints = [new Color('#8fb8ff'), new Color('#ffffff'), new Color('#ffd9a8')];
    for (let i = 0; i < COUNT; i++) {
      const sprite = this.#sprites.createSprite()!;
      const depth = 0.25 + (i % 3) * 0.375;
      const size = 2 + depth * 4;
      sprite.setSize(size, size);
      // the whole dot texture
      sprite.setTexCoords(0, 0, 1, 1);
      sprite.setColor(tints[i % 3]!, 0.35 + depth * 0.65);
      const star = {sprite, depth, x: (Math.random() - 0.5) * SPREAD_X, y: (Math.random() - 0.5) * SPREAD_Y};
      sprite.setPosition(star.x, star.y, 0);
      this.#stars.push(star);
    }
    this.#sprites.update();

    on(this.stage, OnStageUpdateFrame, ({deltaTime}: StageUpdateFrameProps) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    this.warp += (this.targetWarp - this.warp) * Math.min(1, deltaTime * 2.5);
    const fall = 60 * this.warp * deltaTime;
    for (const star of this.#stars) {
      star.y -= fall * star.depth * star.depth * 2;
      if (star.y < -SPREAD_Y / 2) {
        star.y += SPREAD_Y;
        star.x = (Math.random() - 0.5) * SPREAD_X;
      }
      // a fast fall draws the stars out to streaks
      const size = 2 + star.depth * 4;
      star.sprite.setSize(size, size * (1 + (this.warp - 1) * star.depth * 0.6));
      star.sprite.setPosition(star.x, star.y, 0);
    }
    this.#sprites.update();
  }

  dispose(): void {
    this.#sprites.dispose();
    this.stage.dispose();
  }
}
