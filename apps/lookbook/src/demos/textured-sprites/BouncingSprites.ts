import type {TextureAtlas, TexturedSprite, VertexObjectPool} from '@spearwolf/twopoint5d';
import {SeededRandom} from '~demos/utils/seededRandom';

interface BounceSprite extends TexturedSprite {
  speedX: number;
  speedY: number;
  speedRotate: number;
}

const SPRITES_SEED = 13;

export class BouncingSprites {
  readonly #random = new SeededRandom(SPRITES_SEED);

  name = 'textured-sprites.BouncingSprites';

  gravity = -45;
  startSpeedX = 20;
  startSpeedY = 40;
  startSpeedBaseX = 10;
  startSpeedBaseY = 10;
  fallSpeed = 25;
  fallBaseSpeed = 15;
  upwindBaseSpeed = 0.5;
  upwindSpeed = 0.6;

  speedRotateFactor = 1;
  shouldRotate = true;

  spritePool: VertexObjectPool<TexturedSprite>;
  textureAtlas: TextureAtlas;

  containerWidth: number;
  containerHeight: number;

  spriteSize: number;
  initialSpriteCount: number;

  sprites: BounceSprite[] = [];

  constructor(
    spritePool: VertexObjectPool<TexturedSprite>,
    textureAtlas: TextureAtlas,
    width = 300,
    height = 150,
    spriteSize = 10,
    initialSpriteCount = 256,
  ) {
    this.spritePool = spritePool;
    this.textureAtlas = textureAtlas;
    this.containerWidth = width;
    this.containerHeight = height;
    this.spriteSize = spriteSize;
    this.initialSpriteCount = initialSpriteCount;
  }

  createSprites(count = this.initialSpriteCount, frameId?: number) {
    const [halfWidth, halfHeight] = [this.containerWidth / 2, this.containerHeight / 2];

    for (let i = 0; i < count; i++) {
      const sprite = this.spritePool.createVO() as BounceSprite | undefined;
      // a full pool has no sprite left to hand out; stop instead of pushing a hole into the list
      if (sprite == null) break;

      sprite.setSize(this.spriteSize, this.spriteSize);

      sprite.setPosition(
        this.#random.next() * this.containerWidth - halfWidth,
        this.#random.next() * this.containerHeight - halfHeight,
      );

      // the atlas is loaded before any sprite is created, so both lookups answer a frame
      const frame = (frameId != null ? this.textureAtlas.get(frameId) : this.textureAtlas.randomFrame())!;
      sprite.setFrame(frame);

      sprite.speedX = this.#random.next() * this.startSpeedX + this.startSpeedBaseX;
      sprite.speedY = this.#random.next() * this.startSpeedY - this.startSpeedY / 2 + this.startSpeedBaseY;

      if (this.shouldRotate) {
        sprite.rotation = this.#random.next() * Math.PI * 2;
        sprite.speedRotate = this.#random.next() * Math.PI * this.speedRotateFactor;
      } else {
        sprite.rotation = 0;
        sprite.speedRotate = 0;
      }

      this.sprites.push(sprite);
    }
  }

  animate(delta: number) {
    const deltaFactor = delta;

    const gravity = this.gravity * deltaFactor;
    const halfWidth = this.containerWidth / 2;
    const halfHeight = this.containerHeight / 2;

    this.sprites.forEach((sprite) => {
      if (this.shouldRotate) {
        sprite.rotation += sprite.speedRotate * deltaFactor;
      }

      let {x, y, speedX, speedY} = sprite;

      x += speedX * deltaFactor;
      y += speedY * deltaFactor;

      speedY += gravity;

      if (x > halfWidth) {
        // on the right edge
        speedX = -Math.abs(speedX);
        x = halfWidth;
      } else if (x < -halfWidth) {
        // on the left edge
        speedX = Math.abs(speedX);
        x = -halfWidth;
      }

      if (y > halfHeight) {
        // on the top edge
        speedY = -this.fallBaseSpeed;
        y = halfHeight;
        if (this.#random.next() > 0.5) {
          speedY -= this.#random.next() * this.fallSpeed;
        }
      } else if (y < -halfHeight) {
        // on the bottom edge
        speedY = this.#random.next() * this.upwindSpeed * this.containerHeight + this.upwindBaseSpeed * this.containerHeight;
        y = -halfHeight;
      }

      sprite.x = x;
      sprite.y = y;

      sprite.speedX = speedX;
      sprite.speedY = speedY;
    });
  }
}
