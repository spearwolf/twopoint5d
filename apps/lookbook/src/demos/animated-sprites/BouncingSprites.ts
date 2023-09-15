import type {AnimatedSprite, TextureAtlas, VertexObjectPool} from '@twopoint5d/core';

interface Sprite extends AnimatedSprite {
  speedX: number;
  speedY: number;
  speedRotate: number;
}

export class BouncingSprites {
  gravity = -45;
  startSpeedX = 20;
  startSpeedY = 40;
  startSpeedBaseX = 20;
  startSpeedBaseY = 10;
  upwindBaseSpeed = 35;
  upwindSpeed = 50;
  speedRotateFactor = -1.2;

  spritePool: VertexObjectPool<AnimatedSprite>;
  textureAtlas: TextureAtlas;

  containerWidth: number;
  containerHeight: number;

  spriteSize: number;
  initalSpriteCount: number;

  sprites: Sprite[] = [];

  constructor(
    spritePool: VertexObjectPool<AnimatedSprite>,
    textureAtlas: TextureAtlas,
    width = 600,
    height = 300,
    spriteSize = 10,
  ) {
    this.spritePool = spritePool;
    this.textureAtlas = textureAtlas;
    this.containerWidth = width;
    this.containerHeight = height;
    this.spriteSize = spriteSize;
  }

  createSprites(count: number, animId: number) {
    const [halfWidth, halfHeight] = [this.containerWidth / 2, this.containerHeight / 2];

    for (let i = 0; i < count; i++) {
      const sprite = this.spritePool.createVO() as Sprite;

      sprite.setQuadSize([this.spriteSize, this.spriteSize]);

      sprite.animId = animId;
      sprite.animOffset = Math.random();

      sprite.setInstancePosition([
        Math.random() * this.containerWidth - halfWidth,
        Math.random() * this.containerHeight - halfHeight,
        0,
      ]);

      sprite.speedX = -Math.abs(Math.random() * this.startSpeedX + this.startSpeedBaseX);
      sprite.speedY = Math.random() * this.startSpeedY - this.startSpeedY / 2 + this.startSpeedBaseY;

      sprite.rotation = Math.random() * Math.PI * 1.75 + Math.PI * 0.25;
      sprite.speedRotate = Math.random() * Math.PI * this.speedRotateFactor;

      this.sprites.push(sprite);
    }
  }

  animate(delta: number) {
    const deltaFactor = delta;

    const gravity = this.gravity * deltaFactor;
    const halfWidth = this.containerWidth / 2;
    const halfHeight = this.containerHeight / 2;

    this.sprites.forEach((sprite) => {
      sprite.rotation += sprite.speedRotate * deltaFactor;

      const {speedX} = sprite;
      let {x, y, speedY} = sprite;

      x += speedX * deltaFactor;
      y += speedY * deltaFactor;

      speedY += gravity;

      if (x > halfWidth) {
        // on the right edge
        x -= this.containerWidth;
      } else if (x < -halfWidth) {
        // on the left edge
        x += this.containerWidth;
      }

      if (y < -halfHeight) {
        // on the bottom edge
        speedY = Math.random() * this.upwindSpeed + this.upwindBaseSpeed;
        y = -halfHeight;
      }

      sprite.x = x;
      sprite.y = y;

      sprite.speedX = speedX;
      sprite.speedY = speedY;
    });
  }
}
