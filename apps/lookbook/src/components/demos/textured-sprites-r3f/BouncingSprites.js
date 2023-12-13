// const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class BouncingSprites {
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

  sprites = [];
  frames = undefined;

  constructor(width = 100, height = 75, spriteSize = 7) {
    this.containerWidth = width;
    this.containerHeight = height;
    this.spriteSize = spriteSize;

    console.log('new BouncingSprites()', {width, height, spriteSize});
  }

  init({geometry, atlas, capacity}) {
    this.spritePool = geometry.instancedPool;
    this.textureAtlas = atlas;
    this.initalSpriteCount = capacity;

    // this.frames = atlas
    //   .frameNames(/numbers32/)
    //   .map((name) => atlas.frame(name));

    this.createSprites();

    console.log('bouncingSprites.init()', this);
  }

  createSprites(count = this.initalSpriteCount) {
    const [halfWidth, halfHeight] = [this.containerWidth / 2, this.containerHeight / 2];

    for (let i = 0; i < count; i++) {
      const sprite = this.spritePool.createVO();

      sprite.setSize(this.spriteSize, this.spriteSize);

      sprite.setPosition(Math.random() * this.containerWidth - halfWidth, Math.random() * this.containerHeight - halfHeight);

      sprite.setFrame(
        // this.frames ? sample(this.frames) : this.textureAtlas.randomFrame()
        this.textureAtlas.randomFrame(),
      );

      sprite.speedX = Math.random() * this.startSpeedX + this.startSpeedBaseX;
      sprite.speedY = Math.random() * this.startSpeedY - this.startSpeedY / 2 + this.startSpeedBaseY;

      sprite.rotation = Math.random() * Math.PI * 2;
      sprite.speedRotate = Math.random() * Math.PI * this.speedRotateFactor;

      sprite.setColor([1, 1, 1, 1]);

      this.sprites.push(sprite);
    }
  }

  update(args) {
    console.log('update', args);
  }

  frame({delta}) {
    const deltaFactor = delta;

    const gravity = this.gravity * deltaFactor;
    const halfWidth = this.containerWidth / 2;
    const halfHeight = this.containerHeight / 2;

    this.sprites.forEach((sprite) => {
      sprite.rotation += sprite.speedRotate * deltaFactor;

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
