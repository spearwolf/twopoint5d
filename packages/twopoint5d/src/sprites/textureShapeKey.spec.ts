import {
  CubeTexture,
  DataArrayTexture,
  DepthTexture,
  FloatType,
  LessCompare,
  LinearFilter,
  NearestFilter,
  NearestMipmapNearestFilter,
  RedFormat,
  RenderTarget,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {textureShapeKey} from './textureShapeKey.js';

const imageOf = (width: number, height: number) => ({width, height}) as unknown as HTMLImageElement;

describe('textureShapeKey()', () => {
  test('answers undefined without a texture', () => {
    expect(textureShapeKey(undefined)).toBeUndefined();
  });

  test('answers the same key for two fresh textures', () => {
    expect(textureShapeKey(new Texture())).toBe(textureShapeKey(new Texture()));
  });

  const changes: [name: string, change: (texture: Texture) => void][] = [
    ['colorSpace', (texture) => void (texture.colorSpace = SRGBColorSpace)],
    ['type', (texture) => void (texture.type = FloatType)],
    ['format', (texture) => void (texture.format = RedFormat)],
  ];

  test.each(changes)('answers another key for another %s', (_name, change) => {
    const texture = new Texture();
    change(texture);

    expect(textureShapeKey(texture)).not.toBe(textureShapeKey(new Texture()));
  });

  const builds: [name: string, build: () => Texture][] = [
    ['a CubeTexture', () => new CubeTexture()],
    ['a DataArrayTexture', () => new DataArrayTexture()],
  ];

  test.each(builds)('answers another key for %s', (_name, build) => {
    expect(textureShapeKey(build())).not.toBe(textureShapeKey(new Texture()));
  });

  test('answers another key for a texture whose filters are both nearest', () => {
    const texture = new Texture();
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;

    expect(textureShapeKey(texture)).not.toBe(textureShapeKey(new Texture()));
  });

  test('answers another key for a texture whose filters are neither nearest nor linear', () => {
    const texture = new Texture();
    texture.minFilter = NearestMipmapNearestFilter;
    texture.magFilter = NearestFilter;

    expect(textureShapeKey(texture)).not.toBe(textureShapeKey(new Texture()));
  });

  test('answers another key for a depth texture that compares', () => {
    const comparing = new DepthTexture(4, 4);
    comparing.compareFunction = LessCompare;

    expect(textureShapeKey(comparing)).not.toBe(textureShapeKey(new DepthTexture(4, 4)));
  });

  test('answers another key for the depth texture of a multisampled render target', () => {
    const multisampled = new RenderTarget(4, 4, {samples: 4, depthTexture: new DepthTexture(4, 4)});
    const single = new RenderTarget(4, 4, {depthTexture: new DepthTexture(4, 4)});

    expect(textureShapeKey(multisampled.depthTexture!)).not.toBe(textureShapeKey(single.depthTexture!));

    multisampled.dispose();
    single.dispose();
  });

  test('answers the same key for the color textures of a multisampled and a single-sampled render target', () => {
    const multisampled = new RenderTarget(4, 4, {samples: 4});
    const single = new RenderTarget(4, 4);

    expect(textureShapeKey(multisampled.texture)).toBe(textureShapeKey(single.texture));

    multisampled.dispose();
    single.dispose();
  });

  test('answers the same key for textures that differ only in image, size, filter and wrap', () => {
    const a = new Texture(imageOf(4, 4));
    const b = new Texture(imageOf(64, 16));
    b.magFilter = NearestFilter;
    b.minFilter = LinearFilter;
    b.wrapS = RepeatWrapping;
    b.wrapT = RepeatWrapping;

    expect(textureShapeKey(b)).toBe(textureShapeKey(a));
  });
});
