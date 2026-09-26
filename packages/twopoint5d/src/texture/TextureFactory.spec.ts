import {
  LinearFilter,
  LinearSRGBColorSpace,
  NearestFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type WebGPURenderer,
} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';
import {isTextureOptionClass, TextureFactory, type TextureOptionClasses} from './TextureFactory.js';

// the factory asks a renderer for exactly one thing, so a stub that answers it is a renderer enough
const rendererWithMaxAnisotropy = (max: number): WebGPURenderer => ({getMaxAnisotropy: () => max}) as unknown as WebGPURenderer;

const rendererWithoutMaxAnisotropy = (): WebGPURenderer => ({}) as unknown as WebGPURenderer;

describe('TextureFactory', () => {
  describe('anisotropy reaches the texture', () => {
    test('a class below the maximum is written to texture.anisotropy', () => {
      const factory = new TextureFactory(16, []);

      const texture = factory.update(new Texture(), 'anisotropy-4');

      expect(texture.anisotropy).toBe(4);
      expect(texture).not.toHaveProperty('anisotrophy');
    });

    test('a class above the maximum is capped at the maximum', () => {
      const factory = new TextureFactory(2, []);

      expect(factory.update(new Texture(), 'anisotropy-4').anisotropy).toBe(2);
    });

    test('the open class takes whatever the maximum is', () => {
      const factory = new TextureFactory(8, []);

      expect(factory.update(new Texture(), 'anisotropy').anisotropy).toBe(8);
    });

    test('no anisotropic filtering is the value 1, which is what three.js calls off', () => {
      const factory = new TextureFactory(16, []);

      expect(factory.update(new Texture(), 'no-anisotropy').anisotropy).toBe(1);
    });

    test('a renderer that cannot name a maximum hands out none', () => {
      const factory = new TextureFactory(rendererWithoutMaxAnisotropy(), []);

      expect(factory.getOptions(['anisotropy-4']).anisotropy).toBe(1);
      expect(factory.update(new Texture(), 'anisotropy-4').anisotropy).toBe(1);
    });

    test('a renderer that names a maximum caps against it', () => {
      const factory = new TextureFactory(rendererWithMaxAnisotropy(2), []);

      expect(factory.update(new Texture(), 'anisotropy-4').anisotropy).toBe(2);
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

    test("['anisotropy-4','no-anisotropy'] ends on no-anisotropy", () => {
      expect(getOptions(['anisotropy-4', 'no-anisotropy']).anisotropy).toBe(1);
    });

    test("['no-anisotropy','anisotropy-4'] ends on anisotropy-4", () => {
      expect(getOptions(['no-anisotropy', 'anisotropy-4']).anisotropy).toBe(4);
    });
  });

  describe('the deprecated anisotrophy spelling', () => {
    const aliases = [
      ['anisotrophy', 'anisotropy'],
      ['anisotrophy-2', 'anisotropy-2'],
      ['anisotrophy-4', 'anisotropy-4'],
      ['no-anisotrophy', 'no-anisotropy'],
    ] as const satisfies ReadonlyArray<readonly [TextureOptionClasses, TextureOptionClasses]>;

    test.each(aliases)('%s gives the same options and the same texture.anisotropy as %s', (alias, name) => {
      const factory = new TextureFactory(8, []);

      expect(factory.getOptions([alias])).toEqual(factory.getOptions([name]));
      expect(factory.update(new Texture(), alias).anisotropy).toBe(factory.update(new Texture(), name).anisotropy);
    });

    test('getOptions() answers anisotropy counted from 1 and anisotrophy counted from 0', () => {
      const none = new TextureFactory(16, []).getOptions(['no-anisotropy']);
      expect([none.anisotropy, none.anisotrophy]).toEqual([1, 0]);

      const noMaximum = new TextureFactory(0, []).getOptions(['anisotropy-4']);
      expect([noMaximum.anisotropy, noMaximum.anisotrophy]).toEqual([1, 0]);

      const four = new TextureFactory(8, []).getOptions(['anisotropy-4']);
      expect([four.anisotropy, four.anisotrophy]).toEqual([4, 4]);
    });

    test('defaultOptions with anisotrophy alone count it, and with both keys anisotropy counts', () => {
      const alone = new TextureFactory(16, [], {anisotrophy: 4});
      expect(alone.getOptions([]).anisotropy).toBe(4);
      expect(alone.update(new Texture()).anisotropy).toBe(4);

      const both = new TextureFactory(16, [], {anisotropy: 2, anisotrophy: 4});
      expect(both.getOptions([]).anisotropy).toBe(2);
      expect(both.update(new Texture()).anisotropy).toBe(2);
    });

    test('update() leaves no own anisotrophy key on the texture', () => {
      const factory = new TextureFactory(16, [], {anisotrophy: 4});

      expect(Object.hasOwn(factory.update(new Texture()), 'anisotrophy')).toBe(false);
      expect(Object.hasOwn(factory.update(new Texture(), 'anisotrophy-2'), 'anisotrophy')).toBe(false);
      expect(Object.hasOwn(factory.update(new Texture(), 'anisotropy-2'), 'anisotrophy')).toBe(false);
    });
  });

  describe('a load that fails reaches the caller', () => {
    test('loadAsync rejects and applies the texture classes to what it got', async () => {
      const loadAsync = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(new Texture());
      const factory = new TextureFactory(16, []);

      const texture = await factory.loadAsync('sprite.png', ['nearest']);

      expect(loadAsync).toHaveBeenCalledWith('sprite.png');
      expect(texture.magFilter).toBe(NearestFilter);

      loadAsync.mockRejectedValue(new Error('404'));

      await expect(factory.loadAsync('missing.png')).rejects.toThrow('404');

      loadAsync.mockRestore();
    });

    test('load passes onError through and still applies the texture classes', () => {
      const failure = new Error('404');
      const load = vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, onLoad, _onProgress, onError) => {
        // the loader types what it hands out as the texture of an image element
        const texture = new Texture<HTMLImageElement>();
        onLoad?.(texture);
        onError?.(failure);
        return texture;
      });
      const factory = new TextureFactory(16, []);

      const onError = vi.fn();
      const texture = factory.load('sprite.png', {onError}, 'nearest');

      expect(onError).toHaveBeenCalledWith(failure);
      expect(texture.magFilter).toBe(NearestFilter);

      load.mockRestore();
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

  describe('isTextureOptionClass() tells class names from other values, and getOptions() skips the others', () => {
    const everyClassName = [
      'anisotropy',
      'anisotropy-2',
      'anisotropy-4',
      'no-anisotropy',
      'anisotrophy',
      'anisotrophy-2',
      'anisotrophy-4',
      'no-anisotrophy',
      'nearest',
      'mag-nearest',
      'min-nearest',
      'linear',
      'mag-linear',
      'min-linear',
      'flipy',
      'no-flipy',
      'srgb',
      'linear-srgb',
    ] satisfies TextureOptionClasses[];

    test.each(everyClassName)('isTextureOptionClass(%j) answers true', (name) => {
      expect(isTextureOptionClass(name)).toBe(true);
    });

    // `toString` is reachable through `in` on every object, and a check built on `in` would take it
    test.each(['nearset', 'toString', 5, undefined])('isTextureOptionClass(%j) answers false', (name) => {
      expect(isTextureOptionClass(name)).toBe(false);
    });

    // the second order is the one that tells: a sort whose comparator answers NaN for the
    // unknown name leaves `linear` behind `mag-nearest`, and `linear` then has the last word
    test.each([
      [
        ['linear', 'nearset', 'mag-nearest'],
        ['linear', 'mag-nearest'],
      ],
      [
        ['mag-nearest', 'nearset', 'linear'],
        ['mag-nearest', 'linear'],
      ],
    ] as Array<[TextureOptionClasses[], TextureOptionClasses[]]>)(
      'getOptions() skips a name that is no texture option class and orders the rest as if it were not there: %j',
      (withUnknown, without) => {
        const factory = new TextureFactory(16, []);

        const options = factory.getOptions(withUnknown);

        expect(options).toEqual(factory.getOptions(without));
        expect(options.magFilter).toBe(NearestFilter);
        expect(options.minFilter).toBe(LinearFilter);
      },
    );
  });
});
