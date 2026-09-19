import {Texture} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';
import type {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';
import {TextureCoords} from './TextureCoords.js';
import type {TextureFactory} from './TextureFactory.js';
import {TextureImageLoader} from './TextureImageLoader.js';

describe('TextureImageLoader', () => {
  test('a throw in the texture factory rejects the promise and frees the texture', async () => {
    const failure = new Error('no texture');
    const disposeSpy = vi.spyOn(Texture.prototype, 'dispose');

    // hands the test the callback of the image loader, so the test fires the `load` event itself
    let deliver!: () => void;
    const imageLoader = {
      load(_url: string, onLoad: (image: unknown) => void) {
        deliver = () => onLoad({imgEl: {} as HTMLImageElement, texCoords: new TextureCoords(0, 0, 16, 16)});
      },
    } as unknown as PowerOf2ImageLoader;
    const textureFactory = {
      update() {
        throw failure;
      },
    } as unknown as TextureFactory;

    const promise = new TextureImageLoader(textureFactory, imageLoader).loadAsync('image.png', []);
    deliver();

    await expect(promise).rejects.toBe(failure);
    expect(disposeSpy).toHaveBeenCalledOnce();
  });
});
