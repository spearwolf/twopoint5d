import {emit, emitSafe, type EventizedObject, off, on, once, retain} from '@spearwolf/eventize';
import {batch, createSignal, SignalGroup} from '@spearwolf/signalize';
import {ImageLoader, type Texture, type WebGPURenderer} from 'three/webgpu';
import type {FrameBasedAnimations} from './FrameBasedAnimations.js';
import {
  changeRefCount,
  type ImageLease,
  imageSource,
  loadFailureFor,
  type TextureImageSource,
  type TextureResourceLoadFailure,
} from './internals.js';
import {
  assertTextureStoreData,
  listCatalogValues,
  partitionTextureClasses,
  textureResourceDataProblems,
} from './checkTextureStoreData.js';
import {resolveRelativeUrl} from './resolveRelativeUrl.js';
import type {TextureAtlas} from './TextureAtlas.js';
import type {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TextureResource, TextureResourceEvents, type TextureResourceSubType} from './TextureResource.js';
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
 * - `Resource`: prefix for per-id events emitted as `resource:<id>` with every `parse()` that
 *   names the id. `onResource(id, cb)` gives the resource once, as soon as it is there;
 *   `on(id, type, cb)` follows its values across every `parse()`, a resource that takes the
 *   place of an evicted one included. Whoever wants the raw event subscribes to `resource:<id>`
 *   on the store directly.
 * - `Dispose`: fires once when `dispose()` is called.
 * - `Error`: fires with `{source: 'fetch'|'parse', url?, id?, status?, error}`.
 *   `fetch` covers a request that failed and a response that answered with a status;
 *   `parse` a body that is no JSON, a `parse()` that threw — data without an items object
 *   among it —, an item that builds no resource because it names no source or carries a
 *   field of the wrong type, and texture class names no `TextureFactory` knows, which are
 *   left out. The `atlas`, `image` and `texture` failures of a resource are emitted by
 *   `TextureResource` and are subscribed there; {@link TextureStore.getAsync} is rejected on
 *   those that keep a value it asks for from arriving, as its TSDoc sets out.
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
// whatever the failure can be pinned to — the url that was being fetched, the id of the item
// that is at fault — an item without a source has no url of its own —, or the url of the catalog
// for what belongs to it as a whole
const loadFailedError = (source: string, what: string | URL | undefined, cause: unknown): Error =>
  new Error(`[TextureStore] load failed at the ${source} step${what != null ? `: "${String(what)}"` : ''}`, {cause});

// one message for a getAsync() whose resource reported a failure that keeps a value it asks for
// from arriving, naming the step that failed and the url it failed on, if there is one
const resourceFailedError = (what: string, {source, url, error}: TextureResourceLoadFailure): Error =>
  new Error(`[TextureStore] ${what} failed at the ${source} step${url != null ? `: "${url}"` : ''}`, {cause: error});

export interface TextureStoreParseOptions {
  /**
   * Dispose and remove every resource that the parsed data no longer names and whose
   * `refCount` is 0.
   *
   * `refCount` counts the live {@link TextureStore.on} subscriptions of a resource. A
   * value fetched through {@link TextureStore.getAsync} does not raise it: that promise
   * gives its subscription up as it settles, so a texture sitting in a material counts for
   * nothing here. A caller who wants to keep such a value keeps a subscription as well.
   *
   * Defaults to `false`, which keeps every resource until
   * {@link TextureStore.clearUnused} is called.
   */
  evictMissing?: boolean;

  /**
   * The url the relative `imageUrl`, `atlasUrl` and `overrideImageUrl` of the items are
   * resolved against: the url of the catalog, so that a catalog names the files next to
   * it. A relative `baseUrl` is itself resolved against the document, in a worker against
   * its location. An absolute url of an item stays exactly as written.
   *
   * {@link TextureStore.loadAsync} sets it to the url it fetches. Without it `parse()`
   * writes the urls as the data carries them, and the browser resolves them against the
   * document; a base that cannot carry a relative url — a `blob:` or a `data:` url — leaves
   * them as written as well.
   */
  baseUrl?: string | URL;
}

export interface TextureStoreLoadOptions extends TextureStoreParseOptions {
  /**
   * Cuts the load short: the fetch is aborted, nothing is parsed, and the promise rejects
   * with an `AbortError`. A signal that aborts once the parse has begun — from a listener inside
   * it among others — changes nothing: the promise resolves with the store.
   */
  signal?: AbortSignal;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TextureStore extends EventizedObject {}

/**
 * The way to load textures, texture atlases and tile sets.
 *
 * A catalog — {@link TextureStoreData} — names the resources: {@link TextureStore.loadAsync}
 * fetches one, {@link TextureStore.parse} takes one that is already at hand, and
 * {@link TextureStore.getAsync} and {@link TextureStore.on} hand out the values the resources
 * build. Every image is fetched once, however many resources name it. Every resource builds
 * its own texture and keeps it; a caller only borrows it.
 *
 * The four callback loaders — `TextureImageLoader`, `TileSetLoader`, `TextureAtlasLoader`
 * and `PowerOf2ImageLoader` — are the older way and deprecated, and the same image comes out
 * of them differently. A loader pads an image whose sides are no powers of 2 onto a canvas
 * whose sides are, hands out its coordinates as a child of that canvas and starts from the
 * texture class `nearest`; the store loads the image as it is, its `imageCoords` are the root
 * of the image, and it starts from no texture class. The texture of a loader belongs to its
 * caller.
 */
export class TextureStore {
  /**
   * Build a store, fetch the catalog at `url` into it and resolve with the store once the
   * catalog has parsed.
   *
   * Every failure the attempt reports counts: a `fetch` that fails, a response that answers
   * with a status, a body that is no JSON, a `parse()` that throws — and a catalog item that
   * builds no resource or a texture class name no `TextureFactory` knows, which the instance
   * method {@link TextureStore.loadAsync} leaves to the `error` event. Nobody can listen to
   * that event on a store before this method hands it out, so this is where they are said
   * out loud. The promise rejects with the first of them — naming the url that failed, the id of
   * the item at fault or, for what belongs to the catalog as a whole such as a texture class in its
   * `defaultTextureClasses`, the url of the catalog, with the reported error as its `cause` —, and
   * with an `AbortError` once `options.signal` aborts; the store built for the attempt is disposed
   * by then.
   *
   * The relative urls of the items are resolved against `url`, and a `baseUrl` in `options`
   * takes its place, as in the instance method.
   */
  static async loadAsync(url: string | URL, options?: TextureStoreLoadOptions): Promise<TextureStore> {
    const store = new TextureStore();

    // the first failure the attempt reports, whether or not it keeps the catalog from parsing
    let failure: Error | undefined;
    const unsubscribeFromError = on(
      store,
      OnError,
      ({source, url: failedUrl, id, error}: {source: string; url?: string | URL; id?: string; error: unknown}) => {
        // a failure that names neither a url nor an item — a texture class in the
        // defaultTextureClasses of the catalog — belongs to the catalog as a whole
        failure ??= loadFailedError(source, failedUrl ?? id ?? url, error);
      },
    );

    try {
      await store.loadAsync(url, options);
      if (failure) throw failure;
    } catch (error) {
      // the instance promise is settled by now, so this dispose() rejects nothing that is
      // still waiting
      store.dispose();
      throw error;
    } finally {
      unsubscribeFromError();
    }

    return store;
  }

  /**
   * Build a store around the catalog at `url`, as {@link TextureStore.loadAsync} does.
   *
   * @deprecated Use {@link TextureStore.loadAsync}. It stays as an alias until a breaking
   *   release removes it.
   */
  static load(url: string | URL): Promise<TextureStore> {
    return TextureStore.loadAsync(url);
  }

  /**
   * The texture classes every resource of this store starts from, merged with whatever an
   * item names for itself.
   *
   * {@link TextureStore.parse} reads it: an assignment reaches a resource with the next
   * `parse()` that names that resource, and a `parse()` whose data carries a
   * `defaultTextureClasses` with a known texture class name left in it replaces this value
   * before it reads it. A resource that no later `parse()` names keeps the classes it was
   * given.
   *
   * Keeps its last value once {@link TextureStore.dispose} has run: a configuration array
   * is no resource, and the answer stays right.
   */
  defaultTextureClasses: TextureOptionClasses[] = [];

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
  //
  // An image is given up one microtask after its last lease comes back, not at once:
  // signalize calls the cleanup of an effect right before its next run, and that run asks
  // for the same url straight away. A change of texture classes or of the renderer would
  // otherwise find an empty cache and fetch again, an image that is still loading among
  // them. And a lease knows its entry instead of looking it up by url: a failed entry has
  // already been replaced by the time the resource that held it lets go, and a release by
  // url would hit the successor.
  #imageSource: TextureImageSource = {
    acquire: (url: string): ImageLease => {
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
    },
  };

  #disposed = false;

  // aborted by dispose(): every loadAsync() under way listens to it, cuts its fetch short and
  // rejects
  #disposal = new AbortController();

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
   * Call `callback` once with the resource `id` — right away if it is already there, otherwise
   * with the first {@link TextureStore.parse} that brings it. A later `parse()` that names the
   * id again does not call it, nor does a resource that takes the place of an evicted one;
   * {@link TextureStore.on} follows the values of a resource. The returned function takes back
   * a callback that is still waiting.
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
    return once(this, `${OnResource}:${id}`, (resource: TextureResource) => callback(resource));
  }

  // Call `callback` with the resource `id` right away and once, if it is already there, otherwise
  // with every `parse()` that brings it for as long as the subscription stands — the same instance
  // again included. `on()` and `getAsync()` need that, so that a resource which takes the place of
  // an evicted one reaches them; both skip an instance they already hold.
  #followResource(id: string, callback: (resource: TextureResource) => void): () => void {
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
   * Fetch the catalog at `url`, hand it to {@link TextureStore.parse} and resolve with this
   * store once it has parsed.
   *
   * The promise rejects when the catalog never gets as far as the parse: a `fetch` that
   * fails, a response that answers with a status, a body that is no JSON, a `parse()` that
   * throws. Each of these goes out as an `error` event as well, and the rejection names the
   * step and the url and carries the reported error as its `cause`. An `error` listener that
   * throws changes nothing of this: every listener hears the event, eventize reports the throw
   * on the console, and the promise rejects as described. A catalog item that
   * builds no resource and a texture class name no `TextureFactory` knows are `error` events
   * only: the rest of the catalog is parsed, and the promise resolves.
   *
   * `options.signal` cuts the load short, and so does {@link TextureStore.dispose}: the fetch
   * is aborted, nothing is parsed, and no `error` event goes out. The promise rejects with an
   * `AbortError` for the signal and with the error of a disposed store for `dispose()`. On a
   * store that is already disposed it rejects right away and fetches nothing. Once the parse has
   * begun the load is done: a listener inside `parse()` that aborts the signal or disposes the
   * store changes nothing, and the promise resolves with the store.
   *
   * With `{evictMissing: true}` the parse step also disposes and removes every resource
   * the new data no longer names and whose `refCount` is 0 — see
   * {@link TextureStoreParseOptions.evictMissing} for what that count covers.
   *
   * The relative `imageUrl`, `atlasUrl` and `overrideImageUrl` of the items are resolved
   * against `url`, so a catalog names the files next to it; a `baseUrl` in `options` takes
   * its place. See {@link TextureStoreParseOptions.baseUrl}.
   */
  loadAsync(url: string | URL, options?: TextureStoreLoadOptions): Promise<this> {
    const what = `loadAsync(${String(url)})`;
    if (this.#disposed) return Promise.reject(disposedError(what));

    // the signal belongs to this call and not to the parse
    const {signal, ...parseOptions} = options ?? {};
    if (signal?.aborted) return Promise.reject(new DOMException(`${what} aborted`, 'AbortError'));

    const disposal = this.#disposal.signal;

    return new Promise<this>((resolve, reject) => {
      // the fetch listens to one signal, and two sides pull it: the caller and dispose()
      const fetchAbort = new AbortController();
      let settled = false;

      // once the attempt is over, nothing of it stays on the caller's signal or on the store
      const settle = () => {
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        disposal.removeEventListener('abort', onDispose);
      };

      const cutShort = (error: Error) => {
        if (settled) return;
        settle();
        fetchAbort.abort();
        reject(error);
      };
      const onAbort = () => cutShort(new DOMException(`${what} aborted`, 'AbortError'));
      const onDispose = () => cutShort(disposedError(what));

      signal?.addEventListener('abort', onAbort, {once: true});
      disposal.addEventListener('abort', onDispose, {once: true});

      // A step that fails is reported twice: to whoever listens to the store, and to this caller.
      // emitSafe(): every listener hears it, and one that throws is reported on the console by
      // eventize instead of taking the place of the rejection this caller is owed
      const failed = (source: 'fetch' | 'parse', error: unknown, status?: number): Error => {
        emitSafe(this, OnError, status === undefined ? {source, url, error} : {source, url, status, error});
        return loadFailedError(source, url, error);
      };

      // An attempt that was cut short ends at the next check: what arrives after it is dropped
      // and reports nothing. The check follows every await, because a body that is already
      // there — a mocked `Response#json()` among them — resolves without asking the signal.
      const attempt = async (): Promise<void> => {
        let response: Response;
        try {
          response = await fetch(url, {signal: fetchAbort.signal});
        } catch (error) {
          if (settled) return;
          throw failed('fetch', error);
        }
        if (settled) return;
        if (!response.ok) {
          // a status is a failure of the request, not of the parsing — an error response with
          // a JSON body would otherwise pass for a catalog
          throw failed(
            'fetch',
            new Error(`[TextureStore] fetch("${String(url)}") answered ${response.status} ${response.statusText}`),
            response.status,
          );
        }
        let data: TextureStoreData;
        try {
          data = await response.json();
        } catch (error) {
          if (settled) return;
          throw failed('parse', error);
        }
        if (settled) return;
        // Once the parse begins, the load is done: parse() runs through in one go, and a listener
        // inside it — of `ready`, of a resource, of `error` — that aborts the signal or disposes the
        // store finds the data parsed. So the promise settles here, before the parse, and not a
        // microtask after it, by when such an abort would already have rejected it
        settle();
        try {
          this.parse(data, {...parseOptions, baseUrl: parseOptions.baseUrl ?? url});
        } catch (error) {
          reject(failed('parse', error));
          return;
        }
        resolve(this);
      };

      // a step before the parse that fails throws out of attempt(); the parse settles the promise
      // itself
      attempt().catch((error: unknown) => {
        if (settled) return;
        settle();
        reject(error);
      });
    });
  }

  /**
   * Fetch the catalog at `url` into this store, as {@link TextureStore.loadAsync} does, and
   * resolve with this store however the attempt ends. On a disposed store it resolves right
   * away and fetches nothing.
   *
   * @deprecated Use {@link TextureStore.loadAsync}, which rejects when the load fails; this
   *   name resolves with the store all the same and leaves the failure to the error event. It
   *   stays as an alias until a breaking release removes it.
   */
  load(url: string | URL, options?: TextureStoreParseOptions): Promise<TextureStore> {
    return this.loadAsync(url, options).then(
      () => this,
      () => this,
    );
  }

  /**
   * Parse texture store data and update resources.
   *
   * This method can be called multiple times. Resources that were previously loaded
   * and now receive new specifications will be updated accordingly.
   *
   * The data is checked before the first item is written, on two levels. What makes the
   * whole unreadable throws a `TypeError`: data that is no object, an `items` that is no
   * object, a `defaultTextureClasses` that is there and no array. So does an item whose type
   * does not match the resource that already carries its id — one error naming all of them.
   * Nothing has been written or emitted by then.
   *
   * A single item that cannot be read builds no resource and goes out as an `error` event
   * with `source: 'parse'` and its id: one that is no object, one with a field of the wrong
   * type — a url that is no string, a `tileSet` or `frameBasedAnimations` that is no object,
   * a `texture` that is no array; absent is `undefined`, a `null` is a field of the wrong
   * type —, and one that names neither a `tileSet`, an `atlasUrl` nor an `imageUrl`. A
   * resource that already carries that id stays as it is.
   *
   * A texture class name no `TextureFactory` knows, in `texture` or in
   * `defaultTextureClasses`, is left out and reported as an `error` event with
   * `source: 'parse'` — with the id of its item, if it has one; the item is built with the
   * names that are left. Only a `defaultTextureClasses` with a known name left in it
   * replaces {@link TextureStore.defaultTextureClasses}.
   *
   * With `options.baseUrl` the relative `imageUrl`, `atlasUrl` and `overrideImageUrl` of
   * the items are resolved against it — see {@link TextureStoreParseOptions.baseUrl}.
   *
   * The data is configuration, trusted as far as these checks do not reach: a
   * `frameNameQuery` is compiled into a `RegExp` and run against every frame name of its
   * atlas, and a pattern that backtracks catastrophically stalls the page. Check a catalog
   * from a source you do not control before handing it in.
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

    // the shape the loops below read is checked first: data without an items object is
    // refused whole, before anything is written or emitted
    assertTextureStoreData(data);

    // every item is held against what is already there before the first one is written: a
    // parse either runs whole or not at all, instead of leaving half its resources updated
    // and the ready event behind
    const conflicts: string[] = [];
    // every item that builds nothing this run, with what says why; a resource that already
    // carries its id stays as it is
    const skipped = new Map<string, Error>();

    for (const [id, item] of Object.entries(data.items)) {
      const problems = textureResourceDataProblems(item);
      if (problems.length) {
        skipped.set(id, new Error(`[TextureStore] item "${id}" builds no resource: ${problems.join('; ')}`));
        continue;
      }
      const wanted = item.tileSet ? 'tileset' : item.atlasUrl ? 'atlas' : item.imageUrl ? 'image' : undefined;
      if (wanted == null) {
        skipped.set(id, new Error(`[TextureStore] item "${id}" names no tileSet, atlasUrl or imageUrl and builds no resource`));
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

    // only a list with a known name left in it replaces the defaults: one that held nothing
    // but typos would otherwise take every default away
    const defaults = data.defaultTextureClasses === undefined ? undefined : partitionTextureClasses(data.defaultTextureClasses);
    if (defaults?.known.length) {
      this.defaultTextureClasses = defaults.known;
    }
    if (defaults?.unknown.length) {
      emit(this, OnError, {
        source: 'parse',
        error: new Error(
          `[TextureStore] defaultTextureClasses names ${listCatalogValues(defaults.unknown)}, which no TextureFactory knows — left out`,
        ),
      });
    }

    const itemClasses = new Map<string, TextureOptionClasses[]>();
    for (const [id, item] of Object.entries(data.items)) {
      const why = skipped.get(id);
      if (why) {
        emit(this, OnError, {source: 'parse', id, error: why});
        continue;
      }
      if (item.texture === undefined) continue;
      const {known, unknown} = partitionTextureClasses(item.texture);
      itemClasses.set(id, known);
      if (unknown.length) {
        emit(this, OnError, {
          source: 'parse',
          id,
          error: new Error(
            `[TextureStore] item "${id}" names ${listCatalogValues(unknown)} in texture, which no TextureFactory knows — left out`,
          ),
        });
      }
    }

    const baseUrl = options?.baseUrl;
    const resolve = (url: string | undefined) => (url === undefined ? undefined : resolveRelativeUrl(url, baseUrl));

    const updatedResources: TextureResource[] = [];

    batch(() => {
      for (const [id, item] of Object.entries(data.items)) {
        let resource: TextureResource | undefined = this.#resources.get(id);

        // the fields of a skipped item are never read: `tileSet: 5` would pass for a tile set.
        // A resource that already carries its id is announced all the same and stays out of
        // `evictMissing`
        if (skipped.has(id)) {
          if (resource) updatedResources.push(resource);
          continue;
        }

        const textureClasses = joinTextureClasses(this.defaultTextureClasses, itemClasses.get(id));

        if (item.tileSet) {
          if (resource) {
            // The narrowing of `resource` does not reach into the callback, so it is bound here.
            const knownResource = resource;
            batch(() => {
              knownResource.imageUrl = resolve(item.imageUrl);
              knownResource.tileSetOptions = item.tileSet;
              knownResource.textureClasses = textureClasses;
              knownResource.frameBasedAnimationsData = item.frameBasedAnimations;
            });
          } else {
            resource = TextureResource.fromTileSet(
              id,
              resolve(item.imageUrl),
              item.tileSet,
              textureClasses,
              item.frameBasedAnimations,
            );
          }
        } else if (item.atlasUrl) {
          if (resource) {
            const knownResource = resource;
            batch(() => {
              knownResource.atlasUrl = resolve(item.atlasUrl);
              knownResource.overrideImageUrl = resolve(item.overrideImageUrl);
              knownResource.textureClasses = textureClasses;
              knownResource.frameBasedAnimationsData = item.frameBasedAnimations;
            });
          } else {
            resource = TextureResource.fromAtlas(
              id,
              resolveRelativeUrl(item.atlasUrl, baseUrl),
              resolve(item.overrideImageUrl),
              textureClasses,
              item.frameBasedAnimations,
            );
          }
        } else if (item.imageUrl) {
          if (resource) {
            const knownResource = resource;
            batch(() => {
              knownResource.imageUrl = resolve(item.imageUrl);
              knownResource.textureClasses = textureClasses;
            });
          } else {
            resource = TextureResource.fromImage(id, resolveRelativeUrl(item.imageUrl, baseUrl), textureClasses);
          }
        }

        if (resource) {
          if (!this.#resources.has(id)) {
            // the image source goes in before the factory: the image effect returns at once
            // without a factory and runs when it arrives, so an image source set afterwards
            // would miss the first fetch
            resource[imageSource] ??= this.#imageSource;
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
      // that names no source or carries a field of the wrong type builds no resource, yet
      // leaves an existing one in place — and that one is in `updatedResources`
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
   * one of them has a value again. {@link TextureStore.getAsync} inherits this, so it
   * cannot resolve with an `undefined` where its type promises a value.
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
    // the resource the subtype subscriptions below listen to
    let subscribedResource: TextureResource | undefined;
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
      subscribedResource = undefined;
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
        unsubscribeFromResource = this.#followResource(id, (resource) => {
          // a subscription whose resource was still missing at the first ready listens for it
          // on the store for good, and every parse() that names the resource announces it
          // again; subscribing to the same instance anew would deliver its retained values a
          // second time
          if (resource === subscribedResource) return;

          clearSubTypeSubscriptions();

          resource[imageSource] ??= this.#imageSource;
          resource.activate();
          if (this.#textureFactory.value && !resource.textureFactory) {
            resource.textureFactory = this.#textureFactory.value;
          }

          resource[changeRefCount](1);
          unsubscribeFromSubType.push(() => {
            resource[changeRefCount](-1);
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
                // value — and getAsync() would resolve with it
                if (val == null) return;
                callback(val as MapSubTypes<T>);
              }),
            );
          }

          subscribedResource = resource;
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
   *
   * It is rejected as well when the resource reports a failure that keeps a value it asks
   * for from arriving: an image that does not load, an atlas json that cannot be fetched or
   * read or that names no image, a texture that cannot be built — and, for `tileSet`,
   * `atlas` and `frameBasedAnimations`, tile set options that `TileSet` refuses or an atlas
   * json that `TexturePackerJson` cannot read. A failure reported before the call counts as
   * well, until a change of what the failed step reads — its url, its options, the texture
   * classes, the renderer — sends that step off again, or an `atlasJson` written to the
   * resource takes the place of one that could not be fetched or is still being fetched. The
   * error names the step and the url, and carries what the resource reported as its `cause`.
   * An animation entry that is skipped does not reject, and neither does a subscriber of the
   * resource that throws: the value it was handed is there.
   */
  getAsync<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    options?: {signal?: AbortSignal},
  ): Promise<MapSubTypes<T>> {
    return this.#getOnce('getAsync', id, type, options);
  }

  /**
   * Resolve with the value (or tuple of values) of the given subtype(s) as soon as the
   * resource `id` has them, as {@link TextureStore.getAsync} does; its messages name `get()`.
   *
   * @deprecated Use {@link TextureStore.getAsync}: it answers once, as a promise, where a
   *   `get()` of a `Map` answers right away. It stays as an alias until a breaking release
   *   removes it.
   */
  get<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    options?: {signal?: AbortSignal},
  ): Promise<MapSubTypes<T>> {
    return this.#getOnce('get', id, type, options);
  }

  // the body of getAsync() and of its alias; every message names the method the caller wrote,
  // so that it leads back to the line it came from
  #getOnce<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    method: 'get' | 'getAsync',
    id: string,
    type: T,
    options?: {signal?: AbortSignal},
  ): Promise<MapSubTypes<T>> {
    const signal = options?.signal;
    const what = `${method}(${id}, ${String(type)})`;
    return new Promise((resolve, reject) => {
      if (this.#disposed) {
        reject(disposedError(what));
        return;
      }
      if (signal?.aborted) {
        reject(new DOMException(`${method}() aborted before subscription`, 'AbortError'));
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
        reject(new DOMException(`${what} aborted`, 'AbortError'));
      };

      track(
        this.on(id, type, (value) => {
          settle();
          resolve(value);
        }),
      );

      // a failure the resource reported before this call counts like one that arrives while
      // waiting: the step that failed does not run again by itself. A value on() delivers
      // synchronously wins, because on() subscribes first
      const subTypes = (Array.isArray(type) ? type : [type]) as readonly TextureResourceSubType[];
      let watchedResource: TextureResource | undefined;
      track(
        this.#followResource(id, (resource) => {
          if (resource === watchedResource) return;
          watchedResource = resource;
          const rejectIfHeldBack = () => {
            if (settled) return;
            const failure = resource[loadFailureFor](subTypes);
            if (failure == null) return;
            settle();
            reject(resourceFailedError(what, failure));
          };
          track(on(resource, TextureResourceEvents.Error, rejectIfHeldBack));
          rejectIfHeldBack();
        }),
      );

      track(
        once(this, OnDispose, () => {
          settle();
          reject(disposedError(what));
        }),
      );

      // on() keeps waiting for a later parse(); getAsync() answers like whenResource() and gives
      // up once the first ready has gone by without the id showing up
      track(
        once(this, OnReady, () => {
          if (this.#resources.has(id)) return;
          settle();
          reject(noResourceError(id));
        }),
      );

      // the promise may already have settled synchronously; a listener installed now would sit
      // on the caller's signal until that signal aborts — one per such getAsync() on a long-lived
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
   * Every promise handed out by {@link TextureStore.getAsync},
   * {@link TextureStore.whenReady} and {@link TextureStore.whenResource} that is still
   * pending is rejected. So is every {@link TextureStore.loadAsync} still under way — one whose
   * parse has begun is done and resolves —, and its fetch is aborted: once this call returns, no
   * catalog fetch of this store runs any more. The renderer belongs to whoever handed it in and
   * is not disposed. A second call does nothing.
   *
   * The dispose event is the last event this store emits. Afterwards
   * {@link TextureStore.renderer} and {@link TextureStore.textureFactory} answer
   * `undefined`, {@link TextureStore.loadAsync} rejects right away and fetches nothing — the
   * deprecated {@link TextureStore.load} resolves right away instead —, and
   * {@link TextureStore.parse}, {@link TextureStore.on}, {@link TextureStore.onResource} and a
   * write to `renderer` do nothing. {@link TextureStore.defaultTextureClasses} keeps its last
   * value.
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

    // before the resources go: no catalog fetch of this store outlives this call, and no
    // loadAsync() is left waiting for one
    this.#disposal.abort();

    for (const resource of this.#resources.values()) {
      resource.dispose();
    }
    this.#resources.clear();
    this.#images.clear();

    this.#renderer.set(undefined);
    SignalGroup.delete(this);
  }
}
