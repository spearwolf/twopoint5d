import {emit, type EventizedObject, off, on, once, retain} from '@spearwolf/eventize';
import {batch, createSignal, SignalGroup} from '@spearwolf/signalize';
import type {Texture, WebGPURenderer} from 'three/webgpu';
import type {FrameBasedAnimations} from './FrameBasedAnimations.js';
import type {TextureAtlas} from './TextureAtlas.js';
import type {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TextureResource, type TextureResourceSubType} from './TextureResource.js';
import type {TileSet} from './TileSet.js';
import type {TextureStoreData} from './types.js';

/**
 * Maps each TextureResourceSubType to its corresponding TypeScript type.
 */
export type TextureResourceSubTypeMap = {
  imageCoords: TextureCoords;
  atlas: TextureAtlas;
  tileSet: TileSet;
  texture: Texture;
  frameBasedAnimations: FrameBasedAnimations;
};

/**
 * Helper type to recursively map a tuple of TextureResourceSubType to their corresponding types.
 */
export type MapTuple<T extends readonly TextureResourceSubType[]> = T extends readonly [
  infer First extends TextureResourceSubType,
  ...infer Rest extends TextureResourceSubType[],
]
  ? [TextureResourceSubTypeMap[First], ...MapTuple<Rest>]
  : [];

/**
 * Maps an array of TextureResourceSubType to a tuple of their corresponding types.
 * For single types, returns the mapped type directly.
 */
export type MapSubTypes<T extends keyof TextureResourceSubTypeMap | readonly (keyof TextureResourceSubTypeMap)[]> =
  T extends keyof TextureResourceSubTypeMap
    ? TextureResourceSubTypeMap[T]
    : T extends readonly TextureResourceSubType[]
      ? MapTuple<T>
      : never;

/**
 * Public event-name constants emitted by `TextureStore`.
 *
 * - `Ready` (retained): fires once per `parse()` call after all signals have settled.
 *   Payload: the `TextureStore` instance.
 * - `RendererChanged` (retained): fires whenever `renderer` is reassigned (incl. `undefined`).
 *   Payload: the new `WebGPURenderer | undefined`.
 * - `Resource`: prefix for per-id events emitted as `resource:<id>` after `parse()` —
 *   subscribe via the `onResource(id, cb)` helper.
 * - `Dispose`: fires once when `dispose()` is called.
 * - `Error`: fires with `{source: 'fetch'|'parse'|'atlas'|'image', url, error}` payload.
 */
export const TextureStoreEvents = {
  Ready: 'ready',
  RendererChanged: 'rendererChanged',
  Resource: 'resource',
  Dispose: 'dispose',
  Error: 'error',
} as const;

const OnReady = TextureStoreEvents.Ready;
const OnRendererChanged = TextureStoreEvents.RendererChanged;
const OnResource = TextureStoreEvents.Resource;
const OnDispose = TextureStoreEvents.Dispose;
const OnError = TextureStoreEvents.Error;

const joinTextureClasses = (...classes: Array<TextureOptionClasses[] | undefined>): TextureOptionClasses[] | undefined => {
  const all = classes.filter((c) => c != null);
  if (all.length) {
    return Array.from(new Set(all.flat()).values());
  }
  return undefined;
};

// one message for a missing id, shared by every method that gives up on one, so the two
// ways of asking for a resource cannot drift apart in what they say
const noResourceError = (id: string): Error =>
  new Error(`[TextureStore] No resource with id "${id}" — check your TextureStoreData.items keys.`);

// one message for every promise that is cut short, naming the class and the state
const disposedError = (what: string): Error => new Error(`[TextureStore] ${what} was cancelled: this store has been disposed`);

const cmpDefaultClasses = (a: TextureOptionClasses[] | undefined, b: TextureOptionClasses[] | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

export interface TextureStoreParseOptions {
  /**
   * Dispose and remove every resource that the parsed data no longer names and whose
   * `refCount` is 0.
   *
   * `refCount` counts the live {@link TextureStore.on} subscriptions of a resource. A
   * value fetched through {@link TextureStore.get} does not raise it: that promise gives
   * its subscription up as it settles, so a texture sitting in a material counts for
   * nothing here. A caller who wants to keep such a value keeps a subscription as well.
   *
   * Defaults to `false`, which keeps every resource until
   * {@link TextureStore.clearUnused} is called.
   */
  evictMissing?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TextureStore extends EventizedObject {}

export class TextureStore {
  static async load(url: string | URL): Promise<TextureStore> {
    const store = new TextureStore();
    store.load(url);
    return store.whenReady();
  }

  #defaultTextureClasses = createSignal<TextureOptionClasses[]>([], {compare: cmpDefaultClasses, attach: this});

  get defaultTextureClasses(): TextureOptionClasses[] {
    return this.#defaultTextureClasses.value;
  }

  set defaultTextureClasses(value: TextureOptionClasses[]) {
    this.#defaultTextureClasses.set(value);
  }

  #renderer = createSignal<WebGPURenderer | undefined>(undefined, {attach: this});
  #textureFactory = createSignal<TextureFactory | undefined>(undefined, {attach: this});

  get renderer(): WebGPURenderer | undefined {
    return this.#renderer.value;
  }

  set renderer(value: WebGPURenderer | undefined) {
    this.#renderer.set(value);
  }

  /**
   * The shared `TextureFactory` used to materialize textures for every resource
   * managed by this store. Re-created automatically whenever `renderer` changes;
   * consumers should not assign it directly.
   */
  get textureFactory(): TextureFactory | undefined {
    return this.#textureFactory.value;
  }

  #resources = new Map<string, TextureResource>();

  #disposed = false;

  constructor(renderer?: WebGPURenderer) {
    retain(this, [OnReady, OnRendererChanged]);

    this.#renderer.onChange((renderer) => {
      this.#textureFactory.set(renderer ? new TextureFactory(renderer, []) : undefined);
      emit(this, OnRendererChanged, renderer);
    });

    this.#textureFactory.onChange((factory) => {
      for (const resource of this.#resources.values()) {
        resource.textureFactory = factory;
      }
    });

    this.renderer = renderer;
  }

  onResource(id: string, callback: (resource: TextureResource) => void): () => void {
    const resource = this.#resources.get(id);
    if (resource) {
      callback(resource);
      return () => {};
    }
    return on(this, `${OnResource}:${id}`, (resource) => {
      callback(resource);
    });
  }

  /**
   * Resolve once this store has parsed its data for the first time.
   *
   * A promise still pending when {@link TextureStore.dispose} runs is rejected, and a
   * call on a store that is already disposed is rejected right away.
   */
  async whenReady(): Promise<TextureStore> {
    await this.#whenReady('whenReady()');
    return this;
  }

  /**
   * Resolve once the resource with the given `id` is available (typically after
   * the first `parse()` call). Rejects if the store has fired `OnReady` and the
   * id is still not present — useful to surface configuration mistakes instead
   * of hanging promises.
   *
   * A promise still pending when {@link TextureStore.dispose} runs is rejected, and a
   * call on a store that is already disposed is rejected right away.
   */
  async whenResource(id: string): Promise<TextureResource> {
    const existing = this.#resources.get(id);
    if (existing) return existing;
    await this.#whenReady(`whenResource(${id})`);
    const resource = this.#resources.get(id);
    if (!resource) {
      throw noResourceError(id);
    }
    return resource;
  }

  #whenReady(what: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.#disposed) {
        reject(disposedError(what));
        return;
      }
      // dispose() emits before it drops its listeners, so this is the last moment at
      // which a caller waiting for a store that will never be ready can be told
      const unsubscribeDispose = once(this, OnDispose, () => {
        reject(disposedError(what));
      });
      once(this, OnReady, () => {
        unsubscribeDispose();
        resolve();
      });
    });
  }

  /**
   * Fetch texture store data from `url` and hand it to {@link TextureStore.parse}.
   *
   * With `{evictMissing: true}` the parse step also disposes and removes every resource
   * the new data no longer names and whose `refCount` is 0 — see
   * {@link TextureStoreParseOptions.evictMissing} for what that count covers.
   */
  load(url: string | URL, options?: TextureStoreParseOptions) {
    void (async () => {
      let response: Response;
      try {
        response = await fetch(url);
      } catch (error) {
        emit(this, OnError, {source: 'fetch', url, error});
        return;
      }
      let data: TextureStoreData;
      try {
        data = await response.json();
      } catch (error) {
        emit(this, OnError, {source: 'parse', url, error});
        return;
      }
      try {
        this.parse(data, options);
      } catch (error) {
        emit(this, OnError, {source: 'parse', url, error});
      }
    })();
    return this;
  }

  /**
   * Parse texture store data and update resources.
   *
   * This method can be called multiple times. Resources that were previously loaded
   * and now receive new specifications will be updated accordingly.
   *
   * With `{evictMissing: true}` every resource this data no longer names and whose
   * `refCount` is 0 is disposed and removed — the same criterion
   * {@link TextureStore.clearUnused} applies, narrowed to the resources that fell out
   * of the data. See {@link TextureStoreParseOptions.evictMissing} for what that count
   * covers, and what it does not.
   */
  parse(data: TextureStoreData, options?: TextureStoreParseOptions) {
    if (Array.isArray(data.defaultTextureClasses) && data.defaultTextureClasses.length) {
      this.defaultTextureClasses = data.defaultTextureClasses.slice();
    }

    const updatedResources: TextureResource[] = [];

    batch(() => {
      for (const [id, item] of Object.entries(data.items)) {
        let resource: TextureResource | undefined = this.#resources.get(id);

        const textureClasses = joinTextureClasses(item.texture, this.defaultTextureClasses);

        if (item.tileSet) {
          if (resource) {
            if (resource.type !== 'tileset') {
              throw new Error(`Resource ${id} already exists with type "${resource.type}" - cannot change to "tileset"`);
            }
            // The narrowing of `resource` does not reach into the callback, so it is bound here.
            const knownResource = resource;
            batch(() => {
              knownResource.imageUrl = item.imageUrl;
              knownResource.tileSetOptions = item.tileSet;
              knownResource.textureClasses = textureClasses;
              knownResource.frameBasedAnimationsData = item.frameBasedAnimations;
            });
          } else {
            resource = TextureResource.fromTileSet(id, item.imageUrl, item.tileSet, textureClasses, item.frameBasedAnimations);
          }
        } else if (item.atlasUrl) {
          if (resource) {
            if (resource.type !== 'atlas') {
              throw new Error(`Resource ${id} already exists with type "${resource.type}" - cannot change to "atlas"`);
            }
            const knownResource = resource;
            batch(() => {
              knownResource.atlasUrl = item.atlasUrl;
              knownResource.overrideImageUrl = item.overrideImageUrl;
              knownResource.textureClasses = textureClasses;
              knownResource.frameBasedAnimationsData = item.frameBasedAnimations;
            });
          } else {
            resource = TextureResource.fromAtlas(
              id,
              item.atlasUrl,
              item.overrideImageUrl,
              textureClasses,
              item.frameBasedAnimations,
            );
          }
        } else if (item.imageUrl) {
          if (resource) {
            if (resource.type !== 'image') {
              throw new Error(`Resource ${id} already exists with type "${resource.type}" - cannot change to "image"`);
            }
            const knownResource = resource;
            batch(() => {
              knownResource.imageUrl = item.imageUrl;
              knownResource.textureClasses = textureClasses;
            });
          } else {
            resource = TextureResource.fromImage(id, item.imageUrl, textureClasses);
          }
        }

        if (resource) {
          if (!this.#resources.has(id)) {
            resource.textureFactory = this.#textureFactory.value;
          }
          this.#resources.set(id, resource);
          updatedResources.push(resource);
        }
      }
    });

    emit(this, OnReady, this);

    updatedResources.forEach((resource) => {
      emit(this, `${OnResource}:${resource.id}`, resource);
    });

    if (options?.evictMissing) {
      // the set comes from the resources this run touched, not from the data keys: an item
      // that matches none of the three shapes builds no resource, yet leaves an existing one
      // in place — and that one is in `updatedResources`
      const keep = new Set(updatedResources.map((resource) => resource.id));
      for (const [id, resource] of this.#resources) {
        if (keep.has(id) || resource.refCount > 0) continue;
        resource.dispose();
        this.#resources.delete(id);
      }
    }
  }

  on<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    callback: (val: MapSubTypes<T>) => void,
  ): () => void {
    const isMultipleTypes = Array.isArray(type);
    const values = isMultipleTypes
      ? new Map<TextureResourceSubType, TextureResourceSubTypeMap[TextureResourceSubType]>()
      : undefined;

    const unsubscribeFromSubType: (() => void)[] = [];
    let unsubscribeFromResource: undefined | (() => void);

    let isActiveSubscription = true;

    const clearSubTypeSubscriptions = () => {
      unsubscribeFromSubType.forEach((cb) => cb());
      unsubscribeFromSubType.length = 0;
    };

    const unsubscribe: () => void = () => {
      isActiveSubscription = false;
      values?.clear();
      unsubscribeFromResource?.();
      clearSubTypeSubscriptions();
      off(this, OnDispose, unsubscribe);
      off(this, OnReady, onReadyHandler);
    };

    const onReadyHandler = () => {
      if (isActiveSubscription) {
        unsubscribeFromResource = this.onResource(id, (resource) => {
          clearSubTypeSubscriptions();

          resource.load();
          if (this.#textureFactory.value && !resource.textureFactory) {
            resource.textureFactory = this.#textureFactory.value;
          }

          resource.refCount++;
          unsubscribeFromSubType.push(() => {
            resource.refCount--;
          });

          if (isMultipleTypes) {
            // `values` is created exactly when `isMultipleTypes` holds — both spring from the same `Array.isArray(type)` check.
            const valuesByType = values!;
            (type as Array<TextureResourceSubType>).forEach((t) => {
              unsubscribeFromSubType.push(
                on(resource, t, (val) => {
                  valuesByType.set(t, val);
                  const valuesArg = (type as Array<TextureResourceSubType>)
                    .map((t) => valuesByType.get(t))
                    .filter((v) => v != null);
                  if (valuesArg.length === type.length) {
                    callback(valuesArg as MapSubTypes<T>);
                  }
                }),
              );
            });
          } else {
            unsubscribeFromSubType.push(
              on(resource, type as TextureResourceSubType, (val) => {
                callback(val as MapSubTypes<T>);
              }),
            );
          }
        });
      }
    };

    once(this, OnDispose, unsubscribe);
    once(this, OnReady, onReadyHandler);

    return unsubscribe;
  }

  /**
   * Resolve with the value (or tuple of values) of the given subtype(s) as soon as the
   * resource `id` has them.
   *
   * A promise still pending when {@link TextureStore.dispose} runs is rejected, and a
   * call on a store that is already disposed is rejected right away. An id that is
   * still missing once the first `parse()` has gone by is rejected with the same error
   * {@link TextureStore.whenResource} throws, instead of waiting for a later `parse()`.
   */
  get<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    options?: {signal?: AbortSignal},
  ): Promise<MapSubTypes<T>> {
    const signal = options?.signal;
    return new Promise((resolve, reject) => {
      if (this.#disposed) {
        reject(disposedError(`get(${id}, ${String(type)})`));
        return;
      }
      if (signal?.aborted) {
        reject(new DOMException('get() aborted before subscription', 'AbortError'));
        return;
      }

      const teardown: Array<() => void> = [];
      let settled = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        for (const unsubscribe of teardown) unsubscribe();
        teardown.length = 0;
      };

      // every listener this promise installs goes through here: on() can deliver a retained
      // value synchronously, before it has even returned its unsubscribe function, so a
      // subscription registered into an already settled promise is dropped instead of left
      const track = (unsubscribe: () => void) => {
        if (settled) {
          unsubscribe();
        } else {
          teardown.push(unsubscribe);
        }
      };

      const onAbort = () => {
        settle();
        reject(new DOMException(`get(${id}, ${String(type)}) aborted`, 'AbortError'));
      };

      track(
        this.on(id, type, (value) => {
          settle();
          resolve(value);
        }),
      );

      track(
        once(this, OnDispose, () => {
          settle();
          reject(disposedError(`get(${id}, ${String(type)})`));
        }),
      );

      // on() keeps waiting for a later parse(); get() answers like whenResource() and gives
      // up once the first ready has gone by without the id showing up
      track(
        once(this, OnReady, () => {
          if (this.#resources.has(id)) return;
          settle();
          reject(noResourceError(id));
        }),
      );

      // the promise may already have settled synchronously; a listener installed now would sit
      // on the caller's signal until that signal aborts — one per such get() on a long-lived
      // AbortController
      if (!settled) {
        signal?.addEventListener('abort', onAbort, {once: true});
      }
    });
  }

  /**
   * Dispose all resources whose `refCount` is 0 and remove them from the store.
   * Returns the number of resources that were cleared.
   */
  clearUnused(): number {
    let removed = 0;
    for (const [id, resource] of this.#resources) {
      if (resource.refCount <= 0) {
        resource.dispose();
        this.#resources.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Release this store and every resource it holds.
   *
   * Every promise handed out by {@link TextureStore.get},
   * {@link TextureStore.whenReady} and {@link TextureStore.whenResource} that is still
   * pending is rejected. The renderer belongs to whoever handed it in and is not
   * disposed. A second call does nothing.
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;

    emit(this, OnDispose);

    for (const resource of this.#resources.values()) {
      resource.dispose();
    }
    this.#resources.clear();

    this.#renderer.set(undefined);
    SignalGroup.delete(this);

    off(this);
  }
}
