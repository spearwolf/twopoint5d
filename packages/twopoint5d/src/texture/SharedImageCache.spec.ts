import {ImageLoader} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';
import {SharedImageCache} from './SharedImageCache.js';

interface Deferred {
  promise: Promise<HTMLImageElement>;
  reject(error: Error): void;
}

// a load that hangs until it is told to fail
const hangingLoads = () => {
  const loads: Deferred[] = [];
  const loadAsync = vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(() => {
    let reject!: (error: Error) => void;
    const promise = new Promise<HTMLImageElement>((_resolve, rejectLoad) => {
      reject = rejectLoad;
    });
    loads.push({promise, reject});
    return promise;
  });
  return {loads, loadAsync};
};

const settleMicrotasks = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('SharedImageCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('two leases of one url share one load', () => {
    const {loadAsync} = hangingLoads();
    const cache = new SharedImageCache();

    const a = cache.acquire('a.png');
    const b = cache.acquire('a.png');

    expect(loadAsync).toHaveBeenCalledTimes(1);
    expect(a.image).toBe(b.image);
  });

  test('a lease taken in the microtask after the last one came back keeps the image', async () => {
    const {loadAsync} = hangingLoads();
    const cache = new SharedImageCache();

    cache.acquire('a.png').release();
    cache.acquire('a.png');
    await settleMicrotasks();

    expect(loadAsync).toHaveBeenCalledTimes(1);
  });

  test('the image is given up once its last lease has come back, and the next lease loads anew', async () => {
    const {loadAsync} = hangingLoads();
    const cache = new SharedImageCache();

    cache.acquire('a.png').release();
    await settleMicrotasks();
    cache.acquire('a.png');

    expect(loadAsync).toHaveBeenCalledTimes(2);
  });

  test('a load that failed is dropped, and the next lease of the url loads anew', async () => {
    const {loads, loadAsync} = hangingLoads();
    const cache = new SharedImageCache();

    const a = cache.acquire('a.png');
    loads[0]!.reject(new Error('404'));
    await expect(a.image).rejects.toThrow('404');
    await settleMicrotasks();
    cache.acquire('a.png');

    expect(loadAsync).toHaveBeenCalledTimes(2);
  });

  test('a lease of a failed load leaves the load that took its place cached when it comes back', async () => {
    const {loads, loadAsync} = hangingLoads();
    const cache = new SharedImageCache();

    const a = cache.acquire('a.png');
    loads[0]!.reject(new Error('404'));
    await expect(a.image).rejects.toThrow('404');
    await settleMicrotasks();
    const b = cache.acquire('a.png');
    a.release();
    await settleMicrotasks();
    const c = cache.acquire('a.png');

    expect(loadAsync).toHaveBeenCalledTimes(2);
    expect(c.image).toBe(b.image);
  });

  test('a second release() of one lease gives back nothing more', async () => {
    const {loadAsync} = hangingLoads();
    const cache = new SharedImageCache();

    const a = cache.acquire('a.png');
    cache.acquire('a.png');
    a.release();
    a.release();
    await settleMicrotasks();
    cache.acquire('a.png');

    expect(loadAsync).toHaveBeenCalledTimes(1);
  });

  test('clear() forgets every image, and a lease out before it gives back nothing of the next load', async () => {
    const {loadAsync} = hangingLoads();
    const cache = new SharedImageCache();

    const a = cache.acquire('a.png');
    cache.clear();
    const b = cache.acquire('a.png');
    a.release();
    await settleMicrotasks();
    const c = cache.acquire('a.png');

    expect(loadAsync).toHaveBeenCalledTimes(2);
    expect(c.image).toBe(b.image);
  });
});
