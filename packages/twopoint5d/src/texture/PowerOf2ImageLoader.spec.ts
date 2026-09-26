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

  test('an image that is no power of 2 is drawn into a canvas of the next powers of 2', async () => {
    const drawImage = vi.fn();
    const canvas = {width: 0, height: 0, getContext: () => ({drawImage})};
    vi.stubGlobal('document', {createElement: () => canvas});
    const image = {width: 3, height: 5};
    const deliver = captureLoadEvent(image);

    const promise = new PowerOf2ImageLoader().loadAsync('odd.png');
    deliver();

    const {imgEl, texCoords} = await promise;
    expect(imgEl).toBe(canvas);
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(8);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0);
    expect(texCoords).toMatchObject({width: 3, height: 5});
    expect(texCoords.parent).toMatchObject({width: 4, height: 8});
    expect(texCoords.u).toBe(0.75);
    expect(texCoords.v).toBe(0.625);
  });

  test('an image that fails to load rejects the promise with its error', async () => {
    const failure = new Error('404');
    vi.spyOn(ImageLoader.prototype, 'load').mockImplementation(((
      _url: string,
      _onLoad?: unknown,
      _onProgress?: unknown,
      onError?: (error: unknown) => void,
    ) => {
      onError?.(failure);
    }) as unknown as ImageLoader['load']);

    await expect(new PowerOf2ImageLoader().loadAsync('missing.png')).rejects.toBe(failure);
  });

  test('a throw of the load callback is no failure of the load', () => {
    const deliver = captureLoadEvent({width: 4, height: 4});
    const callbackError = new Error('callback');
    const onLoad = () => {
      throw callbackError;
    };
    const onError = vi.fn();

    new PowerOf2ImageLoader().load('even.png', onLoad, onError);

    expect(deliver).toThrow(callbackError);
    expect(onError).not.toHaveBeenCalled();
  });
});
