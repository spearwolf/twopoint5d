import type {FileLoader, Texture} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';
import {TextureAtlasLoader} from './TextureAtlasLoader.js';
import {TextureCoords} from './TextureCoords.js';
import type {TextureImageLoadCallback, TextureImageLoader} from './TextureImageLoader.js';
import type {TextureOptionClasses} from './TextureFactory.js';
import {TexturePackerJson} from './TexturePackerJson.js';
import type {TextureSource} from './types.js';

// the loader asks its file loader for exactly one thing — the parsed json of a url — so a
// stub that answers with a body is a file loader enough
const fileLoaderAnswering = (body: unknown): FileLoader =>
  ({
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
          texture: {} as Texture,
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
});
