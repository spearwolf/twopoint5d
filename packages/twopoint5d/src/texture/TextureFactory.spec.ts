import {LinearFilter, LinearSRGBColorSpace, NearestFilter, SRGBColorSpace, Texture, type WebGPURenderer} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {TextureFactory} from './TextureFactory.js';

// the factory asks a renderer for exactly one thing, so a stub that answers it is a renderer enough
const rendererWithMaxAnisotropy = (max: number): WebGPURenderer => ({getMaxAnisotropy: () => max}) as unknown as WebGPURenderer;

const rendererWithoutMaxAnisotropy = (): WebGPURenderer => ({}) as unknown as WebGPURenderer;

describe('TextureFactory', () => {
  describe('anisotropy reaches the texture', () => {
    test('a class below the maximum is written to texture.anisotropy', () => {
      const factory = new TextureFactory(16, []);

      const texture = factory.update(new Texture(), 'anisotrophy-4');

      expect(texture.anisotropy).toBe(4);
      expect(texture).not.toHaveProperty('anisotrophy');
    });

    test('a class above the maximum is capped at the maximum', () => {
      const factory = new TextureFactory(2, []);

      expect(factory.update(new Texture(), 'anisotrophy-4').anisotropy).toBe(2);
    });

    test('the open class takes whatever the maximum is', () => {
      const factory = new TextureFactory(8, []);

      expect(factory.update(new Texture(), 'anisotrophy').anisotropy).toBe(8);
    });

    test('no anisotropic filtering is the value 1, which is what three.js calls off', () => {
      const factory = new TextureFactory(16, []);

      expect(factory.update(new Texture(), 'no-anisotrophy').anisotropy).toBe(1);
    });

    test('a renderer that cannot name a maximum hands out none', () => {
      const factory = new TextureFactory(rendererWithoutMaxAnisotropy(), []);

      expect(factory.getOptions(['anisotrophy-4']).anisotrophy).toBe(0);
      expect(factory.update(new Texture(), 'anisotrophy-4').anisotropy).toBe(1);
    });

    test('a renderer that names a maximum caps against it', () => {
      const factory = new TextureFactory(rendererWithMaxAnisotropy(2), []);

      expect(factory.update(new Texture(), 'anisotrophy-4').anisotropy).toBe(2);
    });
  });

  describe('two classes writing the same option: the one named last wins', () => {
    const getOptions = (classNames: Parameters<TextureFactory['getOptions']>[0]) =>
      new TextureFactory(16, []).getOptions(classNames);

    test("['linear','nearest'] ends on nearest", () => {
      expect(getOptions(['linear', 'nearest']).magFilter).toBe(NearestFilter);
    });

    test("['nearest','linear'] ends on linear", () => {
      expect(getOptions(['nearest', 'linear']).magFilter).toBe(LinearFilter);
    });

    test("['no-flipy','flipy'] ends on flipy", () => {
      expect(getOptions(['no-flipy', 'flipy']).flipY).toBe(true);
    });

    test("['flipy','no-flipy'] ends on no-flipy", () => {
      expect(getOptions(['flipy', 'no-flipy']).flipY).toBe(false);
    });

    test("['srgb','linear-srgb'] ends on linear-srgb", () => {
      expect(getOptions(['srgb', 'linear-srgb']).colorSpace).toBe(LinearSRGBColorSpace);
    });

    test("['linear-srgb','srgb'] ends on srgb", () => {
      expect(getOptions(['linear-srgb', 'srgb']).colorSpace).toBe(SRGBColorSpace);
    });

    test("['anisotrophy-4','no-anisotrophy'] ends on no-anisotrophy", () => {
      expect(getOptions(['anisotrophy-4', 'no-anisotrophy']).anisotrophy).toBe(0);
    });

    test("['no-anisotrophy','anisotrophy-4'] ends on anisotrophy-4", () => {
      expect(getOptions(['no-anisotrophy', 'anisotrophy-4']).anisotrophy).toBe(4);
    });
  });

  describe('a narrower class has the last word over a broader one, whoever named it', () => {
    const getOptions = (classNames: Parameters<TextureFactory['getOptions']>[0]) =>
      new TextureFactory(16, []).getOptions(classNames);

    test("['mag-linear','nearest']", () => {
      const options = getOptions(['mag-linear', 'nearest']);
      expect(options.magFilter).toBe(LinearFilter);
      expect(options.minFilter).toBe(NearestFilter);
    });

    test("['nearest','mag-linear']", () => {
      const options = getOptions(['nearest', 'mag-linear']);
      expect(options.magFilter).toBe(LinearFilter);
      expect(options.minFilter).toBe(NearestFilter);
    });
  });
});
