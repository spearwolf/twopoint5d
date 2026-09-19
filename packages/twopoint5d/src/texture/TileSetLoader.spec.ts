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
});
