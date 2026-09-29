import {
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  NearestFilter,
  NearestMipmapLinearFilter,
  type Texture,
  type TextureFilter,
} from 'three/webgpu';

// the flags by which three picks the binding type of a texture — cube, depth, array, 3d, storage,
// video, compressed — and with it the shader code that samples it
const SHAPE_FLAGS = [
  'isDepthTexture',
  'isCubeTexture',
  'isArrayTexture',
  'isDataArrayTexture',
  'isCompressedArrayTexture',
  'is3DTexture',
  'isData3DTexture',
  'isVideoTexture',
  'isCompressedTexture',
  'isStorageTexture',
] as const;

// a filter that blends texels, the filters the node builder counts as filtering
const blends = (filter: TextureFilter): boolean =>
  filter === LinearFilter ||
  filter === LinearMipmapNearestFilter ||
  filter === NearestMipmapLinearFilter ||
  filter === LinearMipmapLinearFilter;

const bit = (value: boolean): string => (value ? '1' : '0');

/**
 * A key for the properties of a texture that shape the shader code or the bind group layout three
 * builds around a `TextureNode`: two textures with the same key can take each other's place as the
 * `value` of one texture node, two with different keys cannot. `undefined` without a texture.
 *
 * The key reads:
 * - `colorSpace`: a texture that is decoded in the shader, as the WebGL2 fallback does for video
 *   textures, is decoded by its color space
 * - `type`: it picks float, int or uint sampling, and a float texture on a device without
 *   `float32-filterable` is read without a sampler
 * - `format`
 * - the flags of the texture classes three binds in a way of their own — cube, depth, array, 3d,
 *   storage, video, compressed; a `DataTexture` binds as a `Texture` does
 * - whether both filters are `NearestFilter`: the WebGPU backend then reads the texture with
 *   `textureLoad` on level 0 and binds no sampler for it
 * - whether a filter blends texels: a texture that cannot be filtered on the device is then
 *   filtered in the shader, and read texel by texel otherwise
 * - whether a `compareFunction` is set, which a depth texture samples with a comparison sampler
 * - whether the render target of a depth texture takes more than one sample, which makes its
 *   binding multisampled; the color texture of such a target binds as the single-sampled texture
 *   it resolves into
 *
 * Everything else — the image, its size, wrapping, `flipY`, and a change between two filters on
 * the same side of the two filter tests — three takes at run time from the `value` of the node: the
 * sampled texture and the sampler of a binding compare that value with what they are bound to and
 * bind anew. A depth texture outside a render target takes its samples from the renderer, which
 * no key of the texture can follow.
 *
 * @internal
 */
export const textureShapeKey = (texture: Texture | undefined): string | undefined => {
  if (texture == null) return undefined;

  let flags = '';
  for (const flag of SHAPE_FLAGS) {
    flags += bit((texture as unknown as Record<string, unknown>)[flag] === true);
  }

  const {minFilter, magFilter} = texture;
  flags += bit(minFilter === NearestFilter && magFilter === NearestFilter);
  flags += bit(blends(minFilter) || blends(magFilter));
  flags += bit(((texture as {compareFunction?: unknown}).compareFunction ?? null) !== null);
  flags += bit((texture as {isDepthTexture?: unknown}).isDepthTexture === true && (texture.renderTarget?.samples ?? 0) > 1);

  return `${texture.colorSpace}|${texture.type}|${texture.format}|${flags}`;
};
