// The keys and types through which `TextureStore` reaches the parts of a `TextureResource`
// that belong to the store and not to its callers. This module is not in `public-api.ts`,
// so that nobody outside `src/texture/` can name them.

/**
 * One image lent out by a {@link TextureImageSource}: the promise of the image, and the
 * way to give it back. `TextureResource` takes one per run of its image effect and gives it
 * back in the cleanup of that run.
 */
export interface ImageLease {
  readonly image: Promise<HTMLImageElement>;
  // gives the image back; a second call does nothing
  release(): void;
}

/**
 * Where a `TextureResource` fetches its image from. `TextureStore` injects its shared,
 * de-duplicating image cache through {@link imageSource}.
 */
export interface TextureImageSource {
  acquire(url: string): ImageLease;
}

/**
 * The payload of an `error` event of a `TextureResource` that keeps a value from arriving,
 * as the resource records it. `TextureStore#getAsync()` reads it through {@link loadFailureFor}.
 */
export interface TextureResourceLoadFailure {
  source: 'image' | 'atlas' | 'texture';
  url?: string;
  id?: string;
  status?: number;
  error: unknown;
}

/** The method of a `TextureResource` through which `TextureStore` changes its `refCount`. */
export const changeRefCount: unique symbol = Symbol('TextureResource.changeRefCount');

/** The field of a `TextureResource` into which `TextureStore` injects its image cache. */
export const imageSource: unique symbol = Symbol('TextureResource.imageSource');

/**
 * The method of a `TextureResource` that answers with the failure that keeps one of the
 * given subtypes from arriving, if there is one. `TextureStore#getAsync()` asks it.
 */
export const loadFailureFor: unique symbol = Symbol('TextureResource.loadFailureFor');
