import type {TextureAtlas, TexturedSprite, TexturedSpritePool} from '@spearwolf/twopoint5d';

interface BounceSprite extends TexturedSprite {
  speedX: number;
  speedY: number;
  speedRotate: number;
}

export class BouncingSprites {
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

  spritePool: TexturedSpritePool;
  textureAtlas: TextureAtlas;

  containerWidth: number;
  containerHeight: number;

  spriteSize: number;
  initialSpriteCount: number;

  sprites: BounceSprite[] = [];

  constructor(
    spritePool: TexturedSpritePool,
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
      const sprite = this.spritePool.createVO() as BounceSprite;

      sprite.setSize(this.spriteSize, this.spriteSize);

      sprite.setPosition(Math.random() * this.containerWidth - halfWidth, Math.random() * this.containerHeight - halfHeight);

      sprite.setFrame(frameId != null ? this.textureAtlas.get(frameId) : this.textureAtlas.randomFrame());

      sprite.speedX = Math.random() * this.startSpeedX + this.startSpeedBaseX;
      sprite.speedY = Math.random() * this.startSpeedY - this.startSpeedY / 2 + this.startSpeedBaseY;

      if (this.shouldRotate) {
        sprite.rotation = Math.random() * Math.PI * 2;
        sprite.speedRotate = Math.random() * Math.PI * this.speedRotateFactor;
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
        if (Math.random() > 0.5) {
          speedY -= Math.random() * this.fallSpeed;
        }
      } else if (y < -halfHeight) {
        // on the bottom edge
        speedY = Math.random() * this.upwindSpeed * this.containerHeight + this.upwindBaseSpeed * this.containerHeight;
        y = -halfHeight;
      }

      sprite.x = x;
      sprite.y = y;

      sprite.speedX = speedX;
      sprite.speedY = speedY;
    });
  }
}
