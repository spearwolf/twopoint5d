class BaseQuad {
  make(width = 0.5, height = 0.5) {
    // prettier-ignore
    this.setPosition([
      - width, - height, 0,
      - width, + height, 0,
      + width, + height, 0,
      + width, - height, 0,
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

export const BaseQuadDescriptor = {
  vertexCount: 4,
  indices: [0, 2, 1, 0, 3, 2],

  attributes: {
    position: { components: ["x", "y", "z"] },
    uv: { size: 2 },
  },

  basePrototype: BaseQuad.prototype,
};

export const InstancedQuadDescriptor = {
  meshCount: 1,

  attributes: {
    quadSize: { components: ["width", "height"] },
    instancePosition: { components: ["x", "y", "z"] },
    texCoords: { size: 4 },
  },
};
