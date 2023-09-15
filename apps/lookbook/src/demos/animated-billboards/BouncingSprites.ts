import type {AnimatedSprite, TextureAtlas, VertexObjectPool} from '@twopoint5d/core';

interface Sprite extends AnimatedSprite {
  speedX: number;
  speedY: number;
  speedRotate: number;
  x0: number;
  z0: number;
}

export class BouncingSprites {
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
  initalSpriteCount: number;

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
      const sprite = this.spritePool.createVO() as Sprite;

      sprite.setQuadSize([this.spriteSize, this.spriteSize]);

      sprite.animId = animId;
      sprite.animOffset = Math.random();

      sprite.x0 = Math.random() * this.containerWidth - halfWidth;
      sprite.y = Math.random() * this.containerHeight + this.ground;
      sprite.z0 = Math.random() * this.containerDepth - halfDepth;

      sprite.speedX = -Math.abs(Math.random() * this.startSpeedX + this.startSpeedBaseX);
      sprite.speedY = Math.random() * this.startSpeedY - this.startSpeedY / 2 + this.startSpeedBaseY;

      sprite.rotation = Math.random() * Math.PI * 1.75 + Math.PI * 0.25;
      sprite.speedRotate = Math.random() * Math.PI * this.speedRotateFactor;

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
        speedY = Math.random() * this.upwindSpeed + this.upwindBaseSpeed;
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
