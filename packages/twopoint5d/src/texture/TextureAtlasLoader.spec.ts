import {FileLoader, type Texture} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';
import {TextureAtlasLoader} from './TextureAtlasLoader.js';
import {TextureCoords} from './TextureCoords.js';
import type {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';
import type {TextureFactory, TextureOptionClasses} from './TextureFactory.js';
import {TextureImageLoader, type TextureImageLoadCallback} from './TextureImageLoader.js';
import {TexturePackerJson} from './TexturePackerJson.js';
import type {TextureSource} from './types.js';

// the loader asks its file loader for exactly one thing — the parsed json of a url — so a
// stub that answers with a body is a file loader enough
const fileLoaderAnswering = (body: unknown): FileLoader =>
  ({
    // the path a three.js loader carries unless one is set
    path: '',
    load(_url: string, onLoad: (data: unknown) => void) {
      onLoad(body);
    },
  }) as unknown as FileLoader;

// the image behind an atlas is not what these tests are about: the stub answers every url
// right away with coordinates the atlas can be measured against
const imageLoaderAnswering = () =>
  vi.fn((_url: string, _textureClasses: Array<TextureOptionClasses>, onLoad: TextureImageLoadCallback) => {
    onLoad({
      texture: {} as Texture,
      imgEl: {} as TextureSource,
      texCoords: new TextureCoords(0, 0, 16, 16),
    });
  });

const atlasJsonWithoutImage = {
  frames: {'walk.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
  meta: {size: {w: 16, h: 16}},
};

const atlasJsonNamingAnImage = {
  frames: {'walk.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
  meta: {image: 'from-json.png', size: {w: 16, h: 16}},
};

describe('TextureAtlasLoader', () => {
  test('a response that is no texture atlas json is reported with its url', async () => {
    const imageLoad = vi.fn();
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering({}),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    await expect(loader.loadAsync('atlas.json')).rejects.toThrow(/"atlas\.json" is no texture atlas json/);

    expect(imageLoad).not.toHaveBeenCalled();
  });

  test('an atlas json that names no image loads with an overrideImageUrl', async () => {
    const imageLoad = imageLoaderAnswering();
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering(atlasJsonWithoutImage),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    const {atlas} = await loader.loadAsync('atlas.json', undefined, {overrideImageUrl: 'sprites.png'});

    expect(imageLoad.mock.calls[0]![0]).toBe('sprites.png');
    expect(atlas.frameNames()).toEqual(['walk.1']);
  });

  test('the meta of a loaded atlas names the image that was loaded', async () => {
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering(atlasJsonWithoutImage),
      textureImageLoader: {load: imageLoaderAnswering()} as unknown as TextureImageLoader,
    });

    const {meta} = await loader.loadAsync('atlas.json', undefined, {overrideImageUrl: 'sprites.png'});

    expect(meta.image).toBe('sprites.png');
  });

  test('an atlas json that names no image is refused without an overrideImageUrl', async () => {
    const imageLoad = imageLoaderAnswering();
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering(atlasJsonWithoutImage),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    await expect(loader.loadAsync('atlas.json')).rejects.toThrow(/"atlas\.json" names no image/);

    expect(imageLoad).not.toHaveBeenCalled();
  });

  test('an atlas json whose frames carry no coordinates is refused', async () => {
    const imageLoad = imageLoaderAnswering();
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering({frames: {'walk.1': {}}, meta: {size: {w: 16, h: 16}}}),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    await expect(loader.loadAsync('atlas.json', undefined, {overrideImageUrl: 'sprites.png'})).rejects.toThrow(
      /is no texture atlas json/,
    );

    expect(imageLoad).not.toHaveBeenCalled();
  });

  test('an atlas json whose meta names no size is refused', async () => {
    const imageLoad = imageLoaderAnswering();
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering({frames: {}, meta: {size: {}}}),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    await expect(loader.loadAsync('atlas.json', undefined, {overrideImageUrl: 'sprites.png'})).rejects.toThrow(
      /is no texture atlas json/,
    );

    expect(imageLoad).not.toHaveBeenCalled();
  });

  test('an overrideImageUrl outranks the image the json names', async () => {
    const imageLoad = imageLoaderAnswering();
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering(atlasJsonNamingAnImage),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    const {meta} = await loader.loadAsync('atlas.json', undefined, {overrideImageUrl: 'sprites.png'});

    expect(imageLoad.mock.calls[0]![0]).toBe('sprites.png');
    expect(meta.image).toBe('sprites.png');
  });

  test('a parse that throws rejects instead of leaving the promise open', async () => {
    // the real `TextureImageLoader` calls back from the `load` event of an `Image`, a task
    // queued outside the synchronous call stack this test is set up in — `queueMicrotask`
    // reproduces that boundary. Without it a throw from the mocked `parse()` would unwind
    // synchronously through `this.load(...)` and land in the `new Promise((resolve, reject) =>
    // ...)` executor above `loadAsync()`, which the JS engine itself turns into a rejection —
    // masking the very bug this test is for
    const imageLoad = vi.fn((_url: string, _textureClasses: Array<TextureOptionClasses>, onLoad: TextureImageLoadCallback) => {
      queueMicrotask(() =>
        onLoad({
          texture: {dispose() {}} as unknown as Texture,
          imgEl: {} as TextureSource,
          texCoords: new TextureCoords(0, 0, 16, 16),
        }),
      );
    });
    const parseSpy = vi.spyOn(TexturePackerJson, 'parse').mockImplementation(() => {
      throw new Error('boom');
    });

    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering(atlasJsonNamingAnImage),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    await expect(loader.loadAsync('atlas.json')).rejects.toThrow(/boom/);

    parseSpy.mockRestore();
  });

  test('a parse that throws releases the texture the image loader handed out', async () => {
    // the same microtask boundary as the test above: the callback of the image loader runs
    // outside the call stack this test is set up in
    const texture = {dispose: vi.fn()} as unknown as Texture;
    const imageLoad = vi.fn((_url: string, _textureClasses: Array<TextureOptionClasses>, onLoad: TextureImageLoadCallback) => {
      queueMicrotask(() =>
        onLoad({
          texture,
          imgEl: {} as TextureSource,
          texCoords: new TextureCoords(0, 0, 16, 16),
        }),
      );
    });
    const parseSpy = vi.spyOn(TexturePackerJson, 'parse').mockImplementation(() => {
      throw new Error('boom');
    });

    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering(atlasJsonNamingAnImage),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    await expect(loader.loadAsync('atlas.json')).rejects.toThrow(/boom/);

    expect(texture.dispose).toHaveBeenCalledTimes(1);

    parseSpy.mockRestore();
  });

  test('a file loader that fails rejects the promise with its error and loads no image', async () => {
    const failure = new Error('404');
    const imageLoad = vi.fn();
    const loader = new TextureAtlasLoader({
      fileLoader: {
        load(_url: string, _onLoad: unknown, _onProgress: unknown, onError: (error: unknown) => void) {
          onError(failure);
        },
      } as unknown as FileLoader,
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    await expect(loader.loadAsync('atlas.json')).rejects.toBe(failure);

    expect(imageLoad).not.toHaveBeenCalled();
  });

  test('an image that fails to load rejects the promise with its error', async () => {
    const failure = new Error('404');
    const imageLoad = vi.fn((_url: string, _textureClasses: unknown, _onLoad: unknown, onError: (error: unknown) => void) =>
      onError(failure),
    );
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering(atlasJsonNamingAnImage),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    await expect(loader.loadAsync('atlas.json')).rejects.toBe(failure);
  });

  test('the texture classes reach the image loader', async () => {
    const imageLoad = imageLoaderAnswering();
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering(atlasJsonWithoutImage),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    await loader.loadAsync('atlas.json', ['nearest'], {overrideImageUrl: 'sprites.png'});

    expect(imageLoad.mock.calls[0]![1]).toEqual(['nearest']);
  });

  test('an atlas json that names an image loads that image and lays its frames inside it', async () => {
    // an absolute url, so it reaches the image loader as the json wrote it
    const atlasJson = {
      frames: {'walk.1': {frame: {x: 8, y: 0, w: 8, h: 8}}},
      meta: {image: 'http://example.test/sprites.png', size: {w: 16, h: 16}},
    };
    const texCoords = new TextureCoords(0, 0, 16, 16);
    const imageLoad = vi.fn((_url: string, _textureClasses: unknown, onLoad: TextureImageLoadCallback) => {
      onLoad({texture: {} as Texture, imgEl: {} as TextureSource, texCoords});
    });
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering(atlasJson),
      textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
    });

    const {atlas} = await loader.loadAsync('atlas.json');

    expect(imageLoad.mock.calls[0]![0]).toBe('http://example.test/sprites.png');
    const coords = atlas.frame('walk.1')!.coords;
    expect(coords.parent).toBe(texCoords);
    expect(coords).toMatchObject({s: 0.5, t: 0, u: 0.5, v: 0.5});
  });

  describe('the image an atlas json names lies next to that json', () => {
    const atlasJsonNamingARelativeImage = {
      frames: {'walk.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
      meta: {image: 'sprites.png', size: {w: 16, h: 16}},
    };

    test('a relative meta.image is resolved against the url of the atlas json', async () => {
      const imageLoad = imageLoaderAnswering();
      const loader = new TextureAtlasLoader({
        fileLoader: fileLoaderAnswering(atlasJsonNamingARelativeImage),
        textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
      });

      const {meta} = await loader.loadAsync('http://example.test/atlases/sprites.json');

      expect(imageLoad.mock.calls[0]![0]).toBe('http://example.test/atlases/sprites.png');
      expect(meta.image).toBe('http://example.test/atlases/sprites.png');
    });

    test('an overrideImageUrl is taken as written', async () => {
      const imageLoad = imageLoaderAnswering();
      const loader = new TextureAtlasLoader({
        fileLoader: fileLoaderAnswering(atlasJsonNamingARelativeImage),
        textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
      });

      const {meta} = await loader.loadAsync('http://example.test/atlases/sprites.json', null, {overrideImageUrl: 'other.png'});

      expect(imageLoad.mock.calls[0]![0]).toBe('other.png');
      expect(meta.image).toBe('other.png');
    });

    test('a relative meta.image is resolved against the url the json came from, path of the file loader included', async () => {
      // a real file loader for its `path`; only the request is answered by hand
      const fileLoader = new FileLoader().setPath('http://example.test/assets/');
      fileLoader.load = ((_url: string, onLoad: (data: unknown) => void) => {
        onLoad(atlasJsonNamingARelativeImage);
      }) as unknown as FileLoader['load'];
      const imageLoad = imageLoaderAnswering();
      const loader = new TextureAtlasLoader({
        fileLoader,
        textureImageLoader: {load: imageLoad} as unknown as TextureImageLoader,
      });

      const {meta} = await loader.loadAsync('sprites.json');

      expect(imageLoad.mock.calls[0]![0]).toBe('http://example.test/assets/sprites.png');
      expect(meta.image).toBe('http://example.test/assets/sprites.png');
    });
  });

  describe('a load that fails names the url the json came from, path of the file loader included', () => {
    const fileLoaderWithPath = (body: unknown) => {
      const fileLoader = new FileLoader().setPath('assets/');
      fileLoader.load = ((_url: string, onLoad: (data: unknown) => void) => {
        onLoad(body);
      }) as unknown as FileLoader['load'];
      return fileLoader;
    };

    test('a response that is no texture atlas json', async () => {
      const loader = new TextureAtlasLoader({
        fileLoader: fileLoaderWithPath({}),
        textureImageLoader: {load: vi.fn()} as unknown as TextureImageLoader,
      });

      await expect(loader.loadAsync('atlas.json')).rejects.toThrow(/"assets\/atlas\.json" is no texture atlas json/);
    });

    test('an atlas json that names no image, without an overrideImageUrl', async () => {
      const loader = new TextureAtlasLoader({
        fileLoader: fileLoaderWithPath(atlasJsonWithoutImage),
        textureImageLoader: {load: vi.fn()} as unknown as TextureImageLoader,
      });

      await expect(loader.loadAsync('atlas.json')).rejects.toThrow(/"assets\/atlas\.json" names no image/);
    });
  });

  test('a path a caller set to undefined at runtime leaves the bare url in the message', async () => {
    const fileLoader = fileLoaderAnswering({});
    (fileLoader as unknown as {path: string | undefined}).path = undefined;
    const loader = new TextureAtlasLoader({
      fileLoader,
      textureImageLoader: {load: vi.fn()} as unknown as TextureImageLoader,
    });

    await expect(loader.loadAsync('atlas.json')).rejects.toThrow('the response of "atlas.json" is no texture atlas json');
  });

  test('the texture of a loaded atlas is named by the resolved url of the image', async () => {
    const imageLoader = {
      load(_url: string, onLoad: (image: unknown) => void) {
        onLoad({imgEl: {} as HTMLImageElement, texCoords: new TextureCoords(0, 0, 16, 16)});
      },
    } as unknown as PowerOf2ImageLoader;
    const loader = new TextureAtlasLoader({
      fileLoader: fileLoaderAnswering({
        frames: {'walk.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
        meta: {image: 'sprites.png', size: {w: 16, h: 16}},
      }),
      textureImageLoader: new TextureImageLoader({update() {}} as unknown as TextureFactory, imageLoader),
    });

    const {texture} = await loader.loadAsync('http://example.test/atlases/sprites.json');

    expect(texture.name).toBe('http://example.test/atlases/sprites.png');
  });
});
