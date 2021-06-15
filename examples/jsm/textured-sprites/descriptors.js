class BaseSprite {
  make(width = 0.5, height = 0.5, xOffset = 0, yOffset = 0) {
    // prettier-ignore
    this.setPosition([
      - width + xOffset, - height + yOffset, 0,
      - width + xOffset, + height + yOffset, 0,
      + width + xOffset, + height + yOffset, 0,
      + width + xOffset, - height + yOffset, 0,
    ]);
    // prettier-ignore
    this.setUv([
      // flipY = false
      0, 1,
      0, 0,
      1, 0,
      1, 1,
    ]);
  }
}

export const BaseSpriteDescriptor = {
  vertexCount: 4,
  indices: [0, 2, 1, 0, 3, 2],

  attributes: {
    position: {components: ['x', 'y', 'z']},
    uv: {size: 2},
  },

  basePrototype: BaseSprite.prototype,
};

export const InstancedSpriteDescriptor = {
  meshCount: 1,

  attributes: {
    quadSize: {components: ['width', 'height']},
    texCoords: {size: 4},
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    rotation: {size: 1, usage: 'dynamic'},
  },
};
