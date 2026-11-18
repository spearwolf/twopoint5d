import {ImageLoader} from 'three/webgpu';
import type {ImageLease, TextureImageSource} from './internals.js';

/**
 * One fetch per url for as long as at least one resource wants it. What is shared is the
 * image and not the texture: each resource applies its own texture classes to it and
 * disposes the texture it built, and a shared Texture would belong to nobody.
 *
 * An image is given up one microtask after its last lease comes back, not at once:
 * signalize calls the cleanup of an effect right before its next run, and that run asks
 * for the same url straight away. A change of texture classes or of the renderer would
 * otherwise find an empty cache and fetch again, an image that is still loading among
 * them. And a lease knows its entry instead of looking it up by url: a failed entry has
 * already been replaced by the time the resource that held it lets go, and a release by
 * url would hit the successor.
 */
export class SharedImageCache implements TextureImageSource {
  #images = new Map<string, {image: Promise<HTMLImageElement>; refCount: number}>();

  /**
   * Leases the image of `url`: the first lease of a url starts its load, every later one shares it.
   * `release()` gives the lease back once — a second call does nothing —, and the image is given up
   * a microtask after its last lease came back. A load that fails is forgotten, so the next lease of
   * its url loads anew.
   */
  acquire(url: string): ImageLease {
    let entry = this.#images.get(url);
    if (!entry) {
      const created = {image: new ImageLoader().loadAsync(url), refCount: 0};
      // a failed load is not kept: the next resource asking for this url gets a fresh
      // attempt instead of the old rejection
      created.image.catch(() => {
        if (this.#images.get(url) === created) this.#images.delete(url);
      });
      this.#images.set(url, created);
      entry = created;
    }
    const leased = entry;
    leased.refCount++;
    let released = false;
    return {
      image: leased.image,
      release: () => {
        if (released) return;
        released = true;
        queueMicrotask(() => {
          leased.refCount--;
          if (leased.refCount <= 0 && this.#images.get(url) === leased) this.#images.delete(url);
        });
      },
    };
  }

  /** Forgets every image. A lease still out gives nothing back afterwards, and the next `acquire()` of its url loads anew. */
  clear(): void {
    this.#images.clear();
  }
}
