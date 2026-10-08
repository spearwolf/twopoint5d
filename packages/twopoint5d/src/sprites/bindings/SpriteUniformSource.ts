import type {Matrix4, Vector3, Vector4} from 'three/webgpu';

/**
 * Writes one uniform of a {@link FeatureSprites} every frame, bound through `bindUniform()`. `type`
 * is the type of that uniform. `write()` writes the value into `out`, the vector of the uniform
 * node itself, in the local space of the sprites: `worldToSprites` is the inverse of their
 * `matrixWorld`, current for this frame. It runs every frame and allocates nothing — it writes
 * fields, and hands no fractional number across a call it makes.
 */
export type SpriteUniformSource =
  | {readonly type: 'vec3'; write(out: Vector3, worldToSprites: Matrix4): void}
  | {readonly type: 'vec4'; write(out: Vector4, worldToSprites: Matrix4): void};
