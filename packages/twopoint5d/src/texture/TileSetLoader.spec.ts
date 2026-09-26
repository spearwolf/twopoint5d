import {Texture} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';
import type {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';
import {TextureCoords} from './TextureCoords.js';
import type {TextureFactory} from './TextureFactory.js';
import {TileSetLoader} from './TileSetLoader.js';

describe('TileSetLoader', () => {
  test('a tile set that is refused rejects the promise and frees the texture', async () => {
    const disposeSpy = vi.spyOn(Texture.prototype, 'dispose');

    // hands the test the callback of the image loader, so the test fires the `load` event itself
    let deliver!: () => void;
    const imageLoader = {
      load(_url: string, onLoad: (image: unknown) => void) {
        deliver = () => onLoad({imgEl: {} as HTMLImageElement, texCoords: new TextureCoords(0, 0, 64, 64)});
      },
    } as unknown as PowerOf2ImageLoader;
    const textureFactory = {update() {}} as unknown as TextureFactory;

    const promise = new TileSetLoader(textureFactory, imageLoader).loadAsync('tiles.png', {tileWidth: 0, tileHeight: 16});
    deliver();

    await expect(promise).rejects.toThrow(RangeError);
    await expect(promise).rejects.toThrow(/tileWidth/);
    expect(disposeSpy).toHaveBeenCalledOnce();
  });

  test('a loaded image comes back as a tile set over its coordinates and a texture named by the url', async () => {
    const imgEl = {} as HTMLImageElement;
    const texCoords = new TextureCoords(0, 0, 64, 64);
    const imageLoader = {
      load(_url: string, onLoad: (image: unknown) => void) {
        onLoad({imgEl, texCoords});
      },
    } as unknown as PowerOf2ImageLoader;
    const update = vi.fn();
    const textureFactory = {update} as unknown as TextureFactory;

    const result = await new TileSetLoader(textureFactory, imageLoader).loadAsync('tiles.png', {tileWidth: 16, tileHeight: 16}, [
      'nearest',
    ]);

    expect(result.tileSet.tileCount).toBe(16);
    expect(result.tileSet.baseCoords).toBe(texCoords);
    expect(result.texture.name).toBe('tiles.png');
    expect(update).toHaveBeenCalledExactlyOnceWith(result.texture, 'nearest');
    expect(result.imgEl).toBe(imgEl);
    expect(result.texCoords).toBe(texCoords);
  });

  test('an image that fails to load rejects the promise with its error and builds no texture', async () => {
    const failure = new Error('404');
    const imageLoader = {
      load(_url: string, _onLoad: unknown, onError: (error: unknown) => void) {
        onError(failure);
      },
    } as unknown as PowerOf2ImageLoader;
    const update = vi.fn();
    const textureFactory = {update} as unknown as TextureFactory;

    await expect(
      new TileSetLoader(textureFactory, imageLoader).loadAsync('missing.png', {tileWidth: 16, tileHeight: 16}),
    ).rejects.toBe(failure);

    expect(update).not.toHaveBeenCalled();
  });
});
