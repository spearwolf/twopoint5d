import type {AnimatedSprite, TextureAtlas, VertexObjectPool} from '@spearwolf/twopoint5d';
import {SeededRandom} from '~demos/utils/seededRandom';

interface Sprite extends AnimatedSprite {
  speedX: number;
  speedY: number;
  speedRotate: number;
  x0: number;
  z0: number;
}

const BILLBOARDS_SEED = 9;

export class BouncingSprites {
  readonly #random = new SeededRandom(BILLBOARDS_SEED);

  gravity = -130;
  startSpeedX = 25;
  startSpeedY = 40;
  startSpeedBaseX = 10;
  startSpeedBaseY = 5;
  upwindBaseSpeed = 50;
  upwindSpeed = 90;
  speedRotateFactor = 1.2;

  spritePool: VertexObjectPool<AnimatedSprite>;
  textureAtlas: TextureAtlas;

  containerWidth: number;
  containerHeight: number;
  containerDepth: number;

  radius: number;
  ground: number;

  spriteSize: number;

  sprites: Sprite[] = [];

  constructor(
    spritePool: VertexObjectPool<AnimatedSprite>,
    textureAtlas: TextureAtlas,
    radius: number,
    height: number,
    depth: number,
    spriteSize = 10,
  ) {
    this.spritePool = spritePool;
    this.textureAtlas = textureAtlas;
    this.radius = radius;
    this.containerWidth = 360;
    this.containerHeight = height;
    this.containerDepth = depth;
    this.spriteSize = spriteSize;
    this.ground = spriteSize / 2;
  }

  createSprites(count: number, animId: number) {
    const [halfWidth, halfDepth] = [this.containerWidth / 2, this.containerDepth / 2];

    for (let i = 0; i < count; i++) {
      const sprite = this.spritePool.createVO() as Sprite | undefined;
      // a full pool has no sprite left to hand out; stop instead of pushing a hole into the list
      if (sprite == null) break;

      sprite.setQuadSize([this.spriteSize, this.spriteSize]);

      sprite.animId = animId;
      sprite.animOffset = this.#random.next();

      sprite.x0 = this.#random.next() * this.containerWidth - halfWidth;
      sprite.y = this.#random.next() * this.containerHeight + this.ground;
      sprite.z0 = this.#random.next() * this.containerDepth - halfDepth;

      sprite.speedX = -Math.abs(this.#random.next() * this.startSpeedX + this.startSpeedBaseX);
      sprite.speedY = this.#random.next() * this.startSpeedY - this.startSpeedY / 2 + this.startSpeedBaseY;

      sprite.rotation = this.#random.next() * Math.PI * 1.75 + Math.PI * 0.25;
      sprite.speedRotate = this.#random.next() * Math.PI * this.speedRotateFactor;

      this.sprites.push(sprite);
    }
  }

  animate(deltaFactor: number) {
    const gravity = this.gravity * deltaFactor;
    const halfWidth = this.containerWidth / 2;

    this.sprites.forEach((sprite) => {
      sprite.rotation += sprite.speedRotate * deltaFactor;

      const {z0, speedX} = sprite;
      let {x0, y, speedY} = sprite;

      x0 += speedX * deltaFactor;
      y += speedY * deltaFactor;

      speedY += gravity;

      if (x0 > halfWidth) {
        // on the right edge
        x0 -= this.containerWidth;
      } else if (x0 < -halfWidth) {
        // on the left edge
        x0 += this.containerWidth;
      }

      if (y < this.ground) {
        // on the bottom edge
        speedY = this.#random.next() * this.upwindSpeed + this.upwindBaseSpeed;
        y = this.ground;
      }

      sprite.x0 = x0;
      sprite.speedY = speedY;

      const r = this.radius + z0;
      const angle = (x0 * Math.PI) / 180.0;

      sprite.x = r * Math.sin(angle);
      sprite.y = y;
      sprite.z = r * Math.cos(angle);
    });
  }
}
