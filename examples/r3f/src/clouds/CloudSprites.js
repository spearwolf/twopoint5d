/* eslint-disable no-console */

export class CloudSprites {
  get spritePool() {
    return this.geometry.instancedPool;
  }

  get zRangeMin() {
    return (this.capacity * this.gap) / -2 + this.zOffset;
  }

  get zRangeMax() {
    return ((this.capacity + 1) * this.gap) / 2 + this.zOffset;
  }

  get zRange() {
    return this.zRangeMax - this.zRangeMin;
  }

  init() {
    this.#createClouds();
    console.log("cloud-sprites::init", this);
  }

  frame(state, delta) {
    this.#animateClouds(delta);
  }

  #animateClouds(delta) {
    const spritesCount = this.sprites.length;

    for (let i = 0; i < spritesCount; i++) {
      const { sprite } = this.sprites[i];

      sprite.z += this.speed * delta;

      if (sprite.z > this.zRangeMax) {
        sprite.z -= this.zRange;
      }
    }
  }

  #createClouds() {
    this.sprites = [];

    let z = this.zRangeMin;

    for (let i = 0; i < this.capacity; i++) {
      const frame = this.atlas.randomFrame();

      const sprite = this.spritePool.createVO();
      sprite.setSize(frame.coords.width, frame.coords.height);
      sprite.setFrame(frame);
      sprite.setPosition(
        this.width * 2 * Math.random() - this.width + this.xOffset,
        this.height * 2 * Math.random() - this.height + this.yOffset,
        z
      );

      this.sprites.push({ frame, sprite });

      z += this.gap;
    }

    this.geometry.touch({ static: true });
  }
}
