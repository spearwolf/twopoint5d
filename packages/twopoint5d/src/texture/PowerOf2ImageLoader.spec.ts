import {ImageLoader} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';
import {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';

describe('PowerOf2ImageLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // hands the test the callback the underlying loader is given, so the test fires the `load`
  // event of the image itself — the path that has no way back into the promise of `loadAsync()`
  const captureLoadEvent = (image: unknown) => {
    let deliver!: () => void;
    vi.spyOn(ImageLoader.prototype, 'load').mockImplementation(((_url: string, onLoad?: (img: unknown) => void) => {
      deliver = () => onLoad?.(image);
    }) as unknown as ImageLoader['load']);
    return () => deliver();
  };

  test('a canvas without a 2d context rejects the promise', async () => {
    vi.stubGlobal('document', {createElement: () => ({getContext: () => null})});
    const deliver = captureLoadEvent({width: 3, height: 5});

    const promise = new PowerOf2ImageLoader().loadAsync('odd.png');
    deliver();

    await expect(promise).rejects.toThrow(/no 2d context/);
  });

  test('a throw while the canvas is built rejects the promise', async () => {
    vi.stubGlobal('document', {
      createElement: () => {
        throw new Error('no canvas');
      },
    });
    const deliver = captureLoadEvent({width: 3, height: 5});

    const promise = new PowerOf2ImageLoader().loadAsync('odd.png');
    deliver();

    await expect(promise).rejects.toThrow('no canvas');
  });

  test('an image that is a power of 2 resolves as it is, without a document', async () => {
    const image = {width: 4, height: 8};
    const deliver = captureLoadEvent(image);

    const promise = new PowerOf2ImageLoader().loadAsync('even.png');
    deliver();

    const {imgEl, texCoords} = await promise;
    expect(imgEl).toBe(image);
    expect(texCoords).toMatchObject({width: 4, height: 8});
  });
});
