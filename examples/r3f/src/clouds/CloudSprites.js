/* eslint-disable no-console */

export class CloudSprites {
  capacity = 2000;

  gap = 1;

  speed = 20;

  width = 800;
  height = 600;

  xOffset = 0;
  yOffset = 0;
  zOffset = 0;

  fadeInRange = 0.1;
  fadeOutRange = 0.1;

  geometry = null;
  material = null;
  atlas = null;

  #sprites = [];

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
    this.#updateUniforms();

    console.log("cloud-sprites::init", this);
  }

  update(changes) {
    if (["capacity", "gap", "zOffset"].some((key) => key in changes)) {
      this.#updateUniformZRange();
    }
  }

  frame(state, delta) {
    this.#animateClouds(delta);
  }

  #updateUniforms() {
    this.#updateUniformZRange();
  }

  #updateUniformZRange() {
    const { zRange, zRangeMin, zRangeMax } = this;

    this.material.uniforms.fadeInOutZRange.value = [
      zRangeMin,
      zRangeMin + zRange * this.fadeInRange,
      zRangeMax - zRange * this.fadeOutRange,
      zRangeMax,
    ];
  }

  #animateClouds(delta) {
    const spritesCount = this.#sprites.length;

    for (let i = 0; i < spritesCount; i++) {
      const { sprite } = this.#sprites[i];

      sprite.z += this.speed * delta;

      if (sprite.z > this.zRangeMax) {
        sprite.z -= this.zRange;
      }
    }
  }

  #createClouds() {
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

      this.#sprites.push({ frame, sprite });

      z += this.gap;
    }
  }
}
