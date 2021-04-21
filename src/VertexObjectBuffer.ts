
export class VertexObjectBuffer {
  private readonly buffers: Map<string, Float32Array | Float64Array>;

  constructor() {
    this.buffers = new Map();
  }
}
