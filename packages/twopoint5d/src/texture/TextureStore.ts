import {emit, type EventizedObject, off, on, once, retain} from '@spearwolf/eventize';
import {batch, createSignal, SignalGroup} from '@spearwolf/signalize';
import {ImageLoader, type Texture, type WebGPURenderer} from 'three/webgpu';
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
 * - `Error`: fires with `{source: 'fetch'|'parse', url?, id?, status?, error}`.
 *   `fetch` covers a request that failed and a response that answered with a status;
 *   `parse` a body that is no JSON, a `parse()` that threw, and an item that names no
 *   source. The `atlas`, `image` and `texture` failures of a resource are emitted by
 *   `TextureResource` and are subscribed there.
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

// The store defaults come first and an item's own classes last: two equally broad
// classes writing the same option are decided by their order, so the item has the
// last word. A duplicate keeps its last position for the same reason.
const joinTextureClasses = (...classes: Array<TextureOptionClasses[] | undefined>): TextureOptionClasses[] | undefined => {
  const all = classes.filter((c) => c != null);
  if (all.length) {
    const flat = all.flat();
    return flat.filter((className, index) => flat.lastIndexOf(className) === index);
  }
  return undefined;
};

// one message for a missing id, shared by every method that gives up on one, so the two
// ways of asking for a resource cannot drift apart in what they say
const noResourceError = (id: string): Error =>
  new Error(`[TextureStore] No resource with id "${id}" — check your TextureStoreData.items keys.`);

// one message for every promise that is cut short, naming the class and the state
const disposedError = (what: string): Error => new Error(`[TextureStore] ${what} was cancelled: this store has been disposed`);

// one message for a load that never got as far as a parse, naming the step that failed and
// whatever the failure can be pinned to — the url that was being fetched, or the id of the
// item that is at fault; an item without a source has no url of its own
const loadFailedError = (source: string, what: string | URL | undefined, cause: unknown): Error =>
  new Error(`[TextureStore] load failed at the ${source} step${what != null ? `: "${String(what)}"` : ''}`, {cause});

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
  /**
   * Build a store, fetch texture store data from `url` and resolve once it has parsed.
   *
   * A `fetch` that fails, a response that answers with a status, a body that is no JSON and
   * a `parse()` that throws all reject the returned promise — and so does a catalog item
   * that names neither a `tileSet`, an `atlasUrl` nor an `imageUrl`, because that item
   * builds no resource and this is where it is said out loud. The store built for the
   * attempt is disposed by then.
   *
   * The instance method {@link TextureStore.load} of the same name fetches into an existing
   * store and never rejects; `TextureResource#load()` registers the effects of a single
   * resource and fetches nothing by itself.
   */
  static async load(url: string | URL): Promise<TextureStore> {
    const store = new TextureStore();

    let unsubscribeFromError: (() => void) | undefined;
    const whenFailed = new Promise<never>((_resolve, reject) => {
      unsubscribeFromError = once(
        store,
        OnError,
        ({source, url: failedUrl, id, error}: {source: string; url?: string | URL; id?: string; error: unknown}) => {
          reject(loadFailedError(source, failedUrl ?? id, error));
        },
      );
    });

    // the promise of the instance method is left lying here on purpose: it says the attempt
    // is over, and the race below is what says how it went
    void store.load(url);

    try {
      // the loser of this race is not left as an unhandled rejection: Promise.race attaches a
      // handler to every entry, so the discarded whenReady() promise counts as handled
      await Promise.race([store.whenReady(), whenFailed]);
    } catch (error) {
      // disposing from inside the error listener would tear the store down in the middle of
      // the delivery, and the rejection whenReady() throws for a disposed store could cover
      // the real cause up; here the race is long decided
      store.dispose();
      throw error;
    } finally {
      unsubscribeFromError?.();
    }

    return store;
  }

  #defaultTextureClasses = createSignal<TextureOptionClasses[]>([], {compare: cmpDefaultClasses, attach: this});

  /**
   * The texture classes every resource of this store starts from, merged with whatever an
   * item names for itself.
   *
   * Keeps its last value once {@link TextureStore.dispose} has run: a configuration array
   * is no resource, and the answer stays right.
   */
  get defaultTextureClasses(): TextureOptionClasses[] {
    return this.#defaultTextureClasses.value;
  }

  set defaultTextureClasses(value: TextureOptionClasses[]) {
    this.#defaultTextureClasses.set(value);
  }

  #renderer = createSignal<WebGPURenderer | undefined>(undefined, {attach: this});
  #textureFactory = createSignal<TextureFactory | undefined>(undefined, {attach: this});

  /**
   * The renderer this store builds its textures with, or `undefined` while none is set.
   *
   * Answers `undefined` once {@link TextureStore.dispose} has run, whatever is written
   * to the setter afterwards.
   */
  get renderer(): WebGPURenderer | undefined {
    return this.#disposed ? undefined : this.#renderer.value;
  }

  set renderer(value: WebGPURenderer | undefined) {
    this.#renderer.set(value);
  }

  /**
   * The shared `TextureFactory` used to materialize textures for every resource
   * managed by this store. Re-created automatically whenever `renderer` changes;
   * consumers should not assign it directly.
   *
   * Answers `undefined` once {@link TextureStore.dispose} has run.
   */
  get textureFactory(): TextureFactory | undefined {
    return this.#disposed ? undefined : this.#textureFactory.value;
  }

  #resources = new Map<string, TextureResource>();

  #images = new Map<string, {image: Promise<HTMLImageElement>; refCount: number}>();

  // One fetch per url for as long as at least one resource wants it. What is shared is the
  // image and not the texture: each resource applies its own texture classes to it and
  // disposes the texture it built, and a shared Texture would belong to nobody.
  #imageSource = {
    acquire: (url: string): Promise<HTMLImageElement> => {
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
      entry.refCount++;
      return entry.image;
    },
    release: (url: string): void => {
      const entry = this.#images.get(url);
      if (!entry) return;
      entry.refCount--;
      if (entry.refCount <= 0) this.#images.delete(url);
    },
  };

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

  /**
   * Call `callback` with the resource `id` — right away if it is already there, otherwise
   * as soon as a {@link TextureStore.parse} brings it.
   *
   * On a disposed store this does nothing: the callback is never called, and the returned
   * unsubscribe function has nothing to take back.
   */
  onResource(id: string, callback: (resource: TextureResource) => void): () => void {
    if (this.#disposed) return () => {};

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
   * The promise resolves with this store once the attempt is over, and it never rejects:
   * every failure along the way — the fetch, the status of the response, the JSON, the
   * parse — goes out as an `error` event instead. Resolving says the attempt is done, not
   * that it worked; for that, wait on {@link TextureStore.whenReady}.
   *
   * With `{evictMissing: true}` the parse step also disposes and removes every resource
   * the new data no longer names and whose `refCount` is 0 — see
   * {@link TextureStoreParseOptions.evictMissing} for what that count covers.
   *
   * Two more methods carry this name: the static {@link TextureStore.load} builds a store
   * around one such fetch and rejects when it fails, and `TextureResource#load()` registers
   * the effects of a single resource and fetches nothing by itself.
   *
   * On a disposed store nothing is fetched, and the promise resolves with `this` right
   * away.
   */
  load(url: string | URL, options?: TextureStoreParseOptions): Promise<TextureStore> {
    if (this.#disposed) return Promise.resolve(this);

    return (async (): Promise<TextureStore> => {
      let response: Response;
      try {
        response = await fetch(url);
      } catch (error) {
        emit(this, OnError, {source: 'fetch', url, error});
        return this;
      }
      if (!response.ok) {
        // a status is a failure of the request, not of the parsing — an error response with
        // a JSON body would otherwise pass for a catalog
        emit(this, OnError, {
          source: 'fetch',
          url,
          status: response.status,
          error: new Error(`[TextureStore] fetch("${String(url)}") answered ${response.status} ${response.statusText}`),
        });
        return this;
      }
      let data: TextureStoreData;
      try {
        data = await response.json();
      } catch (error) {
        emit(this, OnError, {source: 'parse', url, error});
        return this;
      }
      try {
        this.parse(data, options);
      } catch (error) {
        emit(this, OnError, {source: 'parse', url, error});
      }
      return this;
    })();
  }

  /**
   * Parse texture store data and update resources.
   *
   * This method can be called multiple times. Resources that were previously loaded
   * and now receive new specifications will be updated accordingly.
   *
   * Every item is checked before the first one is written. An item whose type does not
   * match the resource that already carries its id throws — one error naming all of them,
   * and nothing has been written or emitted by then. An item that names neither a
   * `tileSet`, an `atlasUrl` nor an `imageUrl` builds no resource and goes out as an
   * `error` event with `source: 'parse'` and its id; a resource that already carries that
   * id stays as it is.
   *
   * With `{evictMissing: true}` every resource this data no longer names and whose
   * `refCount` is 0 is disposed and removed — the same criterion
   * {@link TextureStore.clearUnused} applies, narrowed to the resources that fell out
   * of the data. See {@link TextureStoreParseOptions.evictMissing} for what that count
   * covers, and what it does not.
   *
   * On a disposed store this does nothing: no resource is built, and none is updated.
   */
  parse(data: TextureStoreData, options?: TextureStoreParseOptions) {
    if (this.#disposed) return;

    if (Array.isArray(data.defaultTextureClasses) && data.defaultTextureClasses.length) {
      this.defaultTextureClasses = data.defaultTextureClasses.slice();
    }

    // every item is held against what is already there before the first one is written: a
    // parse either runs whole or not at all, instead of leaving half its resources updated
    // and the ready event behind
    const conflicts: string[] = [];
    const withoutSource: string[] = [];

    for (const [id, item] of Object.entries(data.items)) {
      const wanted = item.tileSet ? 'tileset' : item.atlasUrl ? 'atlas' : item.imageUrl ? 'image' : undefined;
      if (wanted == null) {
        withoutSource.push(id);
        continue;
      }
      const existing = this.#resources.get(id);
      if (existing && existing.type !== wanted) {
        conflicts.push(`"${id}" is a "${existing.type}" resource and cannot become "${wanted}"`);
      }
    }

    if (conflicts.length) {
      throw new Error(`[TextureStore] parse() found ${conflicts.length} item(s) of a conflicting type: ${conflicts.join('; ')}`);
    }

    for (const id of withoutSource) {
      emit(this, OnError, {
        source: 'parse',
        id,
        error: new Error(`[TextureStore] item "${id}" names no tileSet, atlasUrl or imageUrl and builds no resource`),
      });
    }

    const updatedResources: TextureResource[] = [];

    batch(() => {
      for (const [id, item] of Object.entries(data.items)) {
        let resource: TextureResource | undefined = this.#resources.get(id);

        const textureClasses = joinTextureClasses(this.defaultTextureClasses, item.texture);

        if (item.tileSet) {
          if (resource) {
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
            // the loader goes in before the factory: the image effect returns at once
            // without a factory and runs when it arrives, so a loader set afterwards would
            // miss the first fetch
            resource.imageLoader ??= this.#imageSource;
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

  /**
   * Subscribe to the given subtype(s) of the resource `id`, for as long as the returned
   * function is not called. The callback fires whenever the value — or, for several
   * subtypes, every value of the tuple — is there.
   *
   * Only values that are there are delivered: a subtype that is cleared and announces it
   * does not reach the callback, and for several subtypes the callback waits until every
   * one of them has a value again. {@link TextureStore.get} inherits this, so it cannot
   * resolve with an `undefined` where its type promises a value.
   *
   * For several subtypes the callback is called once per tuple, not once per event: values
   * that belong together change in one go, and the events announcing them arrive one after
   * the other. A tuple in which every value is the one the last call already carried is not
   * delivered a second time.
   *
   * On a disposed store this does nothing: the callback is never called, and the returned
   * unsubscribe function has nothing to take back.
   */
  on<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    callback: (val: MapSubTypes<T>) => void,
  ): () => void {
    if (this.#disposed) return () => {};

    const isMultipleTypes = Array.isArray(type);

    const unsubscribeFromSubType: (() => void)[] = [];
    // the tuple this subscription was last called with, so the several events of one batch
    // deliver it once
    let lastValues: unknown[] | undefined;
    let unsubscribeFromResource: undefined | (() => void);
    // assigned below, once the handlers they release exist; `unsubscribe` closes over them
    // and reads them only when it runs, which is never before that point
    let unsubscribeFromDispose: (() => void) | undefined = undefined;
    let unsubscribeFromReady: (() => void) | undefined = undefined;

    let isActiveSubscription = true;

    const clearSubTypeSubscriptions = () => {
      unsubscribeFromSubType.forEach((cb) => cb());
      unsubscribeFromSubType.length = 0;
      lastValues = undefined;
    };

    const unsubscribe: () => void = () => {
      isActiveSubscription = false;
      unsubscribeFromResource?.();
      clearSubTypeSubscriptions();
      // the handle releases exactly this subscription; off(this, OnReady, …) would take the
      // store's retained ready value with it and leave every later subscriber waiting
      unsubscribeFromDispose?.();
      unsubscribeFromReady?.();
    };

    const onReadyHandler = () => {
      if (isActiveSubscription) {
        unsubscribeFromResource = this.onResource(id, (resource) => {
          clearSubTypeSubscriptions();

          resource.imageLoader ??= this.#imageSource;
          resource.load();
          if (this.#textureFactory.value && !resource.textureFactory) {
            resource.textureFactory = this.#textureFactory.value;
          }

          resource.refCount++;
          unsubscribeFromSubType.push(() => {
            resource.refCount--;
          });

          if (isMultipleTypes) {
            const subTypes = type as Array<TextureResourceSubType>;
            subTypes.forEach((t) => {
              unsubscribeFromSubType.push(
                on(resource, t, () => {
                  // the tuple is read off the resource, not collected from the values the
                  // events carried: values that belong together are written in one batch,
                  // while the events announcing them arrive one after the other. A tuple
                  // assembled from the last event of each subtype would pair a fresh atlas
                  // with the texture of the image before it.
                  //
                  // The other half of that contract lives in the resource: the effects that
                  // derive from an image run at a higher priority than the bridges that emit,
                  // so no event of such a batch finds a value of the run before it
                  const valuesArg = subTypes.map((subType) => resource[subType]).filter((v) => v != null);
                  if (valuesArg.length !== subTypes.length) return;
                  // and because every event of such a batch reads the same finished tuple,
                  // the callback would otherwise be called once per event with it
                  if (lastValues?.every((value, index) => value === valuesArg[index])) return;
                  lastValues = valuesArg;
                  callback(valuesArg as MapSubTypes<T>);
                }),
              );
            });
          } else {
            unsubscribeFromSubType.push(
              on(resource, type as TextureResourceSubType, (val) => {
                // the same filter the tuple path applies: a signal that is cleared and notifies
                // would otherwise hand the callback an undefined where its type promises a
                // value — and get() would resolve with it
                if (val == null) return;
                callback(val as MapSubTypes<T>);
              }),
            );
          }
        });
      }
    };

    unsubscribeFromDispose = once(this, OnDispose, unsubscribe);
    unsubscribeFromReady = once(this, OnReady, onReadyHandler);

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
   *
   * The dispose event is the last event this store emits. Afterwards
   * {@link TextureStore.renderer} and {@link TextureStore.textureFactory} answer
   * `undefined`, and {@link TextureStore.parse}, {@link TextureStore.load},
   * {@link TextureStore.on}, {@link TextureStore.onResource} and a write to `renderer`
   * do nothing. {@link TextureStore.defaultTextureClasses} keeps its last value.
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;

    // the listeners are still attached here: this event is what tells them to let go,
    // and off(this) below is what makes it the last event this store ever emits — the
    // clean-up underneath gives the renderer up, and the change bridge would otherwise
    // follow the dispose event with a rendererChanged
    emit(this, OnDispose);
    off(this);

    for (const resource of this.#resources.values()) {
      resource.dispose();
    }
    this.#resources.clear();
    this.#images.clear();

    this.#renderer.set(undefined);
    SignalGroup.delete(this);
  }
}
