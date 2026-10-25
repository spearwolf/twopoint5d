import {emitSafe, emitStrict, type EventizedObject, off, on, once, Priority, retain} from '@spearwolf/eventize';
import {batch, createSignal, SignalGroup} from '@spearwolf/signalize';
import {ImageLoader, type Texture, type WebGPURenderer} from 'three/webgpu';
import {type AtlasAdapter, type AtlasAdapterEntry, builtInAtlasAdapters, pickAtlasAdapter} from './atlasAdapters.js';
import type {FrameBasedAnimations} from './FrameBasedAnimations.js';
import {
  atlasAdapterPicker,
  changeRefCount,
  type ImageLease,
  imageSource,
  loadFailureFor,
  subTypesOutOfReach,
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
import {ResourceFollower} from './ResourceFollower.js';
import {
  type AnyTextureResource,
  TextureResource,
  TextureResourceEvents,
  type TextureResourceSubType,
  type TextureResourceType,
} from './TextureResource.js';
import type {TileSet} from './TileSet.js';
import type {TextureResourceData, TextureStoreData} from './types.js';
import {describeValue} from '../utils/describeValue.js';
import {expectDefined} from '../utils/expectDefined.js';
import {throwCollected} from '../utils/throwCollected.js';

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
 *
 * @deprecated A step of {@link MapSubTypes}, not a name to use outside the library. It stays exported until
 *   a breaking release.
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
 *
 * @deprecated A helper of the signatures of {@link TextureStore}, not a name to use: name the value of one
 *   subtype as `TextureResourceSubTypeMap['atlas']`, and the values of a list as a tuple of them,
 *   `[TextureResourceSubTypeMap['atlas'], TextureResourceSubTypeMap['texture']]`. It stays exported until a
 *   breaking release.
 */
export type MapSubTypes<T extends keyof TextureResourceSubTypeMap | readonly (keyof TextureResourceSubTypeMap)[]> =
  T extends keyof TextureResourceSubTypeMap
    ? TextureResourceSubTypeMap[T]
    : T extends readonly TextureResourceSubType[]
      ? MapTuple<T>
      : never;

/**
 * The payload of an `error` event of a {@link TextureStore}: a `fetch` that failed or answered
 * with a status, with the url of the request, or a `parse` failure — with the url of the catalog
 * when `loadAsync()` could not parse its body, with the id of the item at fault, or with neither
 * for what belongs to the catalog as a whole. {@link TextureStoreEvents} says when each goes out.
 */
export type TextureStoreErrorEvent =
  | {readonly source: 'fetch'; readonly url: string | URL; readonly status?: number; readonly error: unknown}
  | {readonly source: 'parse'; readonly url?: string | URL; readonly id?: string; readonly error: unknown};

/**
 * Public event-name constants emitted by `TextureStore`.
 *
 * - `Ready` (retained): fires once per `parse()` call after all signals have settled.
 *   Payload: the `TextureStore` instance. Every listener hears it and the retained value is
 *   written, even behind one that throws. A `whenReady()`, `whenResource()`, `getAsync()`, `get()`,
 *   `acquireAsync()` or `on()` that a listener starts hears this `ready`, behind the last listener.
 * - `RendererChanged` (retained): fires whenever `renderer` is reassigned (incl. `undefined`).
 *   Payload: the new `WebGPURenderer | undefined`. Every listener hears it and the retained
 *   value is written, even behind one that throws; the throw goes on to whoever wrote
 *   `renderer`.
 * - `Resource`: prefix for per-id events emitted as `resource:<id>` with every `parse()` that
 *   names the id. `onResource(id, cb)` gives the resource once, as soon as it is there;
 *   `on(id, type, cb)` follows its values across every `parse()`, a resource that takes the
 *   place of an evicted one included. Whoever wants the raw event subscribes to `resource:<id>`
 *   on the store directly.
 * - `Dispose`: fires once when `dispose()` is called.
 * - `Error`: fires with a {@link TextureStoreErrorEvent}, `{source: 'fetch'|'parse', url?, id?,
 *   status?, error}`. `fetch` covers a request that failed and a response that answered with a
 *   status; `parse` a body that is no JSON, a `parse()` that threw — data without an items object
 *   among it —, an item that builds no resource because it names no source or carries a field of
 *   the wrong type, texture class names no `TextureFactory` knows, which are left out, a field the
 *   type of an item does not read, which is left out, a tile set item without an `imageUrl`, which
 *   is built all the same, a subscriber of a resource that throws while `parse()` writes the
 *   values, and a listener of the `dispose` event of a resource that `evictMissing` disposes that
 *   throws. The `atlas`, `image` and `texture` failures of a resource are emitted by
 *   `TextureResource` and are subscribed there; {@link TextureStore.getAsync} is rejected on those
 *   that keep a value it asks for from arriving, as its TSDoc sets out. An `error` listener that
 *   throws takes the event from no other listener: eventize reports the throw on the console.
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

// every error event of the store goes out here, so that its payload is held to the type
const reportError = (store: TextureStore, event: TextureStoreErrorEvent): void => {
  emitSafe(store, OnError, event);
};

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

// Why the last parse() built no resource for an item: `phrase` is the text behind `item "<id>"`, and
// `error` the error its parse error went out with
interface ItemRefusal {
  readonly phrase: string;
  readonly error: Error;
}

const refusalOf = (id: string, phrase: string): ItemRefusal => ({
  phrase,
  error: new Error(`TextureStore: item "${id}" ${phrase}`),
});

// What #checkItems() makes of an item: why it builds nothing, or the type it builds, the known
// classes of its `texture` (`undefined` without one) and every parse error it builds with, in the
// order they go out
type CheckedItem =
  | {readonly refused: ItemRefusal}
  | {readonly type: TextureResourceType; readonly classes: TextureOptionClasses[] | undefined; readonly notes: readonly Error[]};

// What #checkItems() makes of a catalog; `items` in the order of `Object.entries(data.items)`
interface CheckedCatalog {
  readonly defaults: {known: TextureOptionClasses[]; unknown: unknown[]} | undefined;
  readonly items: ReadonlyMap<string, CheckedItem>;
}

// the fields of an item each type of resource reads; parse() writes no other and reports every
// other one an item names. `texture` is read by every type
const FIELDS_READ_BY_TYPE: Record<TextureResourceType, ReadonlySet<keyof TextureResourceData>> = {
  tileset: new Set(['imageUrl', 'tileSet', 'texture', 'frameBasedAnimations']),
  atlas: new Set(['atlasUrl', 'overrideImageUrl', 'atlasAdapter', 'texture', 'frameBasedAnimations']),
  image: new Set(['imageUrl', 'texture']),
};

// every field that one type reads and another does not, in the order a message names them
const TYPE_SPECIFIC_FIELDS = [
  'imageUrl',
  'overrideImageUrl',
  'atlasUrl',
  'atlasAdapter',
  'tileSet',
  'frameBasedAnimations',
] as const;

// one message for a missing id, shared by every method that gives up on one, so the two
// ways of asking for a resource cannot drift apart in what they say; for an id whose item the
// last parse() refused, it says why and carries the error of that parse error as its cause
const noResourceError = (id: string, refusal?: ItemRefusal): Error =>
  refusal
    ? new Error(`TextureStore: no resource with id "${id}" — its item ${refusal.phrase}`, {cause: refusal.error})
    : new Error(`TextureStore: no resource with id "${id}" — check your TextureStoreData.items keys.`);

// one message for every promise that is cut short, naming the class and the state
const disposedError = (what: string): Error => new Error(`TextureStore: ${what} was cancelled: this store has been disposed`);

// one message for a promise whose resource was disposed directly while it waited on it
const resourceDisposedError = (what: string, id: string): Error =>
  new Error(`TextureStore: ${what} was cancelled: the resource "${id}" has been disposed`);

const hrefOf = (url: string | URL): string => (typeof url === 'string' ? url : url.href);

// one message for a load that never got as far as a parse, naming the step that failed and
// whatever the failure can be pinned to — the url that was being fetched, the id of the item
// that is at fault — an item without a source has no url of its own —, or the url of the catalog
// for what belongs to it as a whole
const loadFailedError = (source: string, what: string | URL | undefined, cause: unknown): Error =>
  new Error(`TextureStore: load failed at the ${source} step${what != null ? `: "${hrefOf(what)}"` : ''}`, {cause});

// one message for a getAsync() whose resource reported a failure that keeps a value it asks for
// from arriving, naming the step that failed and the url it failed on, if there is one
const resourceFailedError = (what: string, failure: TextureResourceLoadFailure): Error => {
  const {source, error} = failure;
  const url = 'url' in failure ? failure.url : undefined;
  return new Error(`TextureStore: ${what} failed at the ${source} step${url != null ? `: "${url}"` : ''}`, {cause: error});
};

const articleOf = (type: string): string => (/^[aeiou]/.test(type) ? 'an' : 'a');

// one message for a getAsync() after a subtype its resource never builds: by the type of the
// resource — which wins where the type and the data both rule a subtype out — or by the animation
// data it lacks
const outOfReachError = (what: string, resource: TextureResource, subTypes: readonly TextureResourceSubType[]): Error => {
  const {id, type} = resource;
  const byType = resource[subTypesOutOfReach](subTypes, 'type');
  if (byType.length) {
    return new Error(
      `TextureStore: ${what} cannot resolve: "${id}" is ${articleOf(type)} "${type}" resource, which never builds ${byType.join(', ')}`,
    );
  }
  if (type === 'tileset') {
    return new Error(`TextureStore: ${what} cannot resolve: "${id}" carries no frameBasedAnimations data`);
  }
  return new Error(
    `TextureStore: ${what} cannot resolve: "${id}" carries no frameBasedAnimations data, and its atlas adapter read none out of its json`,
  );
};

/** What {@link TextureStore.acquireAsync} resolves with: the value, and a hold on the resource it came from. */
export interface TextureStoreLease<V> {
  /** The value (or tuple of values) of the subtype(s) asked for. */
  readonly value: V;
  /** Gives the hold back. A second call does nothing. */
  release(): void;
}

// a lease on `resource`, which holds it from here until its release(); a second release() does nothing
const leaseOn = <V>(value: V, resource: TextureResource): TextureStoreLease<V> => {
  resource[changeRefCount](1);
  let released = false;
  return {
    value,
    release: () => {
      if (released) return;
      released = true;
      resource[changeRefCount](-1);
    },
  };
};

// The listeners one promise of #getOnce() installs, given back at once when it settles. A
// listener booked after that is given back right away: on() can deliver a retained value
// synchronously, before it has returned its unsubscribe function, and a subscription booked into
// a settled promise would otherwise stay
class Settlement {
  #settled = false;
  readonly #teardown: Array<() => void> = [];

  get settled(): boolean {
    return this.#settled;
  }

  track(unsubscribe: () => void): void {
    if (this.#settled) unsubscribe();
    else this.#teardown.push(unsubscribe);
  }

  // true for the call that settles, false for every one after it
  settle(): boolean {
    if (this.#settled) return false;
    this.#settled = true;
    for (const unsubscribe of this.#teardown) unsubscribe();
    this.#teardown.length = 0;
    return true;
  }
}

export interface TextureStoreParseOptions {
  /**
   * Dispose and remove every resource that the parsed data no longer names and whose
   * `refCount` is 0.
   *
   * `refCount` counts the live {@link TextureStore.on} subscriptions of a resource. A
   * value fetched through {@link TextureStore.getAsync} does not raise it: that promise
   * gives its subscription up as it settles, so a texture sitting in a material counts for
   * nothing here. A caller who wants to keep such a value holds it with
   * {@link TextureStore.acquireAsync}, or holds a subscription.
   *
   * Defaults to `false`, which keeps every resource until
   * {@link TextureStore.clearUnused} is called.
   *
   * A resource this disposes is removed even when a listener of its `dispose` event throws;
   * that throw goes out as an `error` event with `source: 'parse'` and the id of the resource.
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
   * it among others — changes nothing: the promise resolves with the store. Nor does a signal
   * that aborts after a step has failed, from a listener of the `error` event: the promise
   * rejects with that error.
   */
  signal?: AbortSignal;
}

export interface TextureStore extends EventizedObject {}

/**
 * The way to load textures, texture atlases and tile sets.
 *
 * A catalog — {@link TextureStoreData} — names the resources: {@link TextureStore.loadAsync}
 * fetches one, {@link TextureStore.parse} takes one that is already at hand, and
 * {@link TextureStore.getAsync} and {@link TextureStore.on} hand out the values the resources
 * build. Every image is fetched once, however many resources name it. Every resource builds
 * its own texture and keeps it; a caller only borrows it, and {@link TextureStore.acquireAsync}
 * holds the resource for as long as the caller needs it.
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
   *
   * The store it hands out has no renderer: it loads the images and builds coordinates, atlases,
   * tile sets and animations, and a `getAsync(id, 'texture')` waits until `store.renderer` is set.
   */
  static async loadAsync(url: string | URL, options?: TextureStoreLoadOptions): Promise<TextureStore> {
    const store = new TextureStore();

    // the first failure the attempt reports, whether or not it keeps the catalog from parsing
    let failure: Error | undefined;
    const unsubscribeFromError = on(store, OnError, (event: TextureStoreErrorEvent) => {
      // a failure that names neither a url nor an item — a texture class in the
      // defaultTextureClasses of the catalog — belongs to the catalog as a whole
      failure ??= loadFailedError(
        event.source,
        event.url ?? (event.source === 'parse' ? event.id : undefined) ?? url,
        event.error,
      );
    });

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
   * Without a renderer the store loads its images and builds the coordinates, atlases, tile sets
   * and animations of its resources all the same; only `texture` waits until one is set.
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

  #resources = new Map<string, AnyTextureResource>();

  // why the last parse() refused an item whose id carries no resource; getAsync() and
  // whenResource() say it when they give up on the id
  #refusedItems = new Map<string, ItemRefusal>();

  // Set while ready goes out: what a listener of it books through #onReadyOnce() waits here and
  // hears this ready behind the last listener, ahead of the resource:<id> events. eventize writes
  // the retained ready value only after the last listener, so a once() booked meanwhile would hear
  // the ready of the parse() before at once, and in the first parse(), which has none before it,
  // no ready until the next parse()
  #readyLate: Array<() => void> | undefined;

  // the atlas adapters by name, in the order they were registered: the pick by `meta.app` asks the
  // latest first
  #atlasAdapters: AtlasAdapterEntry[] = builtInAtlasAdapters();

  // what every resource of this store picks an adapter by, while its item names none
  #pickAtlasAdapter = (json: Parameters<typeof pickAtlasAdapter>[1]): AtlasAdapter => pickAtlasAdapter(this.#atlasAdapters, json);

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

  // cuts short the loadAsync() whose fetch is still under way; a later loadAsync() calls it before
  // it fetches itself, so the catalogs are parsed in the order of the calls
  #loadUnderWay?: () => void;

  constructor(renderer?: WebGPURenderer) {
    retain(this, [OnReady, OnRendererChanged]);

    this.#renderer.onChange((renderer) => {
      this.#textureFactory.set(renderer ? new TextureFactory(renderer, []) : undefined);
      // every listener hears it and the retained value is written, even behind one that throws;
      // the throw goes on to whoever wrote `renderer`
      emitStrict(this, OnRendererChanged, renderer);
    });

    this.#textureFactory.onChange((factory) => {
      for (const resource of this.#resources.values()) {
        resource.textureFactory = factory;
      }
    });

    this.renderer = renderer;
  }

  /**
   * Registers an atlas adapter under `name`, or replaces the one registered under it. A catalog item
   * names it with `atlasAdapter: name`; an item that names none is read by the adapter whose `app`
   * matches `meta.app` of its json — the latest registered first — and by `'texturepacker'` when
   * none does. The store starts with `'texturepacker'` (`texturePackerAtlasAdapter`, `app`
   * `/texturepacker|free-tex-packer/i`) and `'aseprite'` (`asepriteAtlasAdapter`, `app`
   * `/aseprite/i`).
   *
   * Register an adapter before the `parse()` or `loadAsync()` whose items name it: a registration
   * reaches the next json a resource reads, a resource that has read its json keeps its atlas. The
   * `app` is copied, so the `RegExp` handed in keeps its `lastIndex`.
   *
   * On a disposed store it still refuses the arguments above and registers nothing.
   *
   * @throws {TypeError} for a name that is no string or the empty string, an adapter that is no
   *   function and an `app` that is no `RegExp`
   */
  registerAtlasAdapter(name: string, adapter: AtlasAdapter, options?: {app?: RegExp}): void {
    if (typeof name !== 'string' || name === '') {
      throw new TypeError(
        `TextureStore: registerAtlasAdapter() got a name of ${describeValue(name)} — an atlas adapter is registered under a name, a string`,
      );
    }
    if (typeof adapter !== 'function') {
      throw new TypeError(
        `TextureStore: registerAtlasAdapter() got an adapter for "${name}" that is no function — an adapter is (json, parentCoords) => {atlas, animations?}`,
      );
    }
    const app: unknown = options?.app;
    if (app !== undefined && !(app instanceof RegExp)) {
      throw new TypeError(
        `TextureStore: registerAtlasAdapter() got an app for "${name}" that is no RegExp — app is matched against meta.app of the json, as /aseprite/i`,
      );
    }
    if (this.#disposed) return;
    this.#atlasAdapters = [
      ...this.#atlasAdapters.filter((entry) => entry.name !== name),
      {name, adapter, app: app === undefined ? undefined : new RegExp(app)},
    ];
  }

  /**
   * Call `callback` once with the resource `id` — right away if it is already there, otherwise
   * with the first {@link TextureStore.parse} that brings it. A later `parse()` that names the
   * id again does not call it, nor does a resource that takes the place of an evicted one;
   * {@link TextureStore.on} follows the values of a resource. The returned function takes back
   * a callback that is still waiting.
   *
   * The resource is an {@link AnyTextureResource}: its `type` narrows it to the class of its shape
   * before an input of that shape is written — after `resource.type === 'atlas'` it is an
   * `AtlasTextureResource`.
   *
   * On a disposed store this does nothing: the callback is never called, and the returned
   * unsubscribe function has nothing to take back.
   */
  onResource(id: string, callback: (resource: AnyTextureResource) => void): () => void {
    if (this.#disposed) return () => {};

    const resource = this.#resources.get(id);
    if (resource) {
      callback(resource);
      return () => {};
    }
    return once(this, `${OnResource}:${id}`, (resource: AnyTextureResource) => callback(resource));
  }

  // the adapter an item names, by its name; the names are checked before parse() writes anything
  #namedAtlasAdapter(name: string | undefined): AtlasAdapter | undefined {
    return name === undefined ? undefined : this.#atlasAdapters.find((entry) => entry.name === name)?.adapter;
  }

  // a follower of the resource under `id`: the one there now, the next one a parse() announces, and
  // the one that takes the place of an instance disposed directly
  #followerOf(id: string): ResourceFollower {
    return new ResourceFollower(
      () => this.#resources.get(id),
      (announced) => on(this, `${OnResource}:${id}`, announced),
    );
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
   * of hanging promises. For an id whose item the last `parse()` refused, the error says why
   * and carries the error of the `error` event of that item as its `cause`.
   *
   * The resource is an {@link AnyTextureResource}: its `type` narrows it to the class of its shape
   * before an input of that shape is written — after `resource.type === 'atlas'` it is an
   * `AtlasTextureResource`.
   *
   * A promise still pending when {@link TextureStore.dispose} runs is rejected, and a
   * call on a store that is already disposed is rejected right away.
   */
  async whenResource(id: string): Promise<AnyTextureResource> {
    const existing = this.#resources.get(id);
    if (existing) return existing;
    await this.#whenReady(`whenResource(${describeValue(id)})`);
    const resource = this.#resources.get(id);
    if (!resource) {
      throw noResourceError(id, this.#refusedItems.get(id));
    }
    return resource;
  }

  // once(this, OnReady, …) that also hears the ready that is going out right now
  #onReadyOnce(hear: () => void): () => void {
    const late = this.#readyLate;
    if (late === undefined) return once(this, OnReady, hear);
    late.push(hear);
    return () => {
      const at = late.indexOf(hear);
      if (at >= 0) late.splice(at, 1);
    };
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
      this.#onReadyOnce(() => {
        unsubscribeDispose();
        resolve();
      });
    });
  }

  /**
   * Fetch the catalog at `url`, hand it to {@link TextureStore.parse} and resolve with this
   * store once it has parsed.
   *
   * The promise rejects when the catalog never gets as far as the parse: a `fetch` that fails,
   * a response that answers with a status, a body that is no JSON, a `parse()` that throws.
   * Each of these goes out as an `error` event as well, and the rejection names the step and
   * the url and carries the reported error as its `cause`. An `error` listener that throws
   * changes nothing of this: every listener hears the event, eventize reports the throw on the
   * console, and the promise rejects as described. A listener that starts another
   * `loadAsync()`, aborts the signal or disposes the store changes nothing of it either: a load
   * whose step has failed is over when the event goes out, and its promise rejects with that
   * error. A catalog item that builds no resource and a texture class name no `TextureFactory`
   * knows are `error` events only: the rest of the catalog is parsed, and the promise resolves.
   * A listener of the store or a subscriber of one of its resources that throws inside the parse
   * changes nothing either — the promise resolves with the store.
   *
   * `options.signal` cuts the load short, and so does {@link TextureStore.dispose}: the fetch
   * is aborted, nothing is parsed, and no `error` event goes out. The promise rejects with an
   * `AbortError` for the signal and with the error of a disposed store for `dispose()`. On a
   * store that is already disposed it rejects right away and fetches nothing. Once the parse has
   * begun the load is done: a listener inside `parse()` that aborts the signal or disposes the
   * store changes nothing, and the promise resolves with the store.
   *
   * A later `loadAsync()` on this store cuts short one that is still under way: its fetch is
   * aborted, nothing of it is parsed, no `error` event goes out, and its promise rejects with an
   * `AbortError`. The catalogs are parsed in the order of the calls. The deprecated
   * {@link TextureStore.load} inherits this and resolves with the store all the same.
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
    const what = `loadAsync(${describeValue(hrefOf(url))})`;
    if (this.#disposed) return Promise.reject(disposedError(what));

    // the signal belongs to this call and not to the parse
    const {signal, ...parseOptions} = options ?? {};
    if (signal?.aborted) return Promise.reject(new DOMException(`TextureStore: ${what} aborted`, 'AbortError'));

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
        if (this.#loadUnderWay === onSuperseded) this.#loadUnderWay = undefined;
      };

      const cutShort = (error: Error) => {
        if (settled) return;
        settle();
        fetchAbort.abort();
        reject(error);
      };
      const onAbort = () => cutShort(new DOMException(`TextureStore: ${what} aborted`, 'AbortError'));
      const onDispose = () => cutShort(disposedError(what));
      // a load whose parse has begun is settled and cut short by nothing, a loadAsync() that a
      // listener inside that parse starts included; so is a load whose step has failed, a loadAsync()
      // that a listener of its `error` event starts included; one that is cut short reports nothing,
      // as one whose signal aborts
      const onSuperseded = () =>
        cutShort(
          new DOMException(`TextureStore: ${what} aborted: a later loadAsync() on this store took its place`, 'AbortError'),
        );

      signal?.addEventListener('abort', onAbort, {once: true});
      disposal.addEventListener('abort', onDispose, {once: true});

      this.#loadUnderWay?.();
      this.#loadUnderWay = onSuperseded;

      // A step that fails is reported twice: to whoever listens to the store, and to this caller.
      // emitSafe(): every listener hears it, and one that throws is reported on the console by
      // eventize instead of taking the place of the rejection this caller is owed
      const failed = (source: 'fetch' | 'parse', error: unknown, status?: number): Error => {
        reportError(this, status === undefined ? {source, url, error} : {source, url, status, error});
        return loadFailedError(source, url, error);
      };

      // A step before the parse that fails ends the attempt before it is reported: a listener of the
      // `error` event that starts another loadAsync(), aborts the signal or disposes the store finds
      // this load over, and the promise rejects with the failure the event told of
      const fail = (source: 'fetch' | 'parse', error: unknown, status?: number): void => {
        settle();
        reject(failed(source, error, status));
      };

      // An attempt that was cut short ends at the next check: what arrives after it is dropped
      // and reports nothing. The check follows every await, because a body that is already
      // there — a mocked `Response#json()` among them — resolves without asking the signal.
      const attempt = async (): Promise<void> => {
        let response: Response;
        try {
          response = await fetch(url, {signal: fetchAbort.signal});
        } catch (error) {
          if (!settled) fail('fetch', error);
          return;
        }
        if (settled) return;
        if (!response.ok) {
          // a status is a failure of the request, not of the parsing — an error response with
          // a JSON body would otherwise pass for a catalog
          fail(
            'fetch',
            new Error(`TextureStore: fetch(${describeValue(hrefOf(url))}) answered ${response.status} ${response.statusText}`),
            response.status,
          );
          return;
        }
        let data: TextureStoreData;
        try {
          data = await response.json();
        } catch (error) {
          if (!settled) fail('parse', error);
          return;
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

      // attempt() settles every failure it reports itself; a throw it does not foresee still rejects
      // the promise instead of leaving it pending
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
   * type —, one that names neither a `tileSet`, an `atlasUrl` nor an `imageUrl`, and an atlas
   * item that names an `atlasAdapter` the store does not know (see
   * {@link TextureStore.registerAtlasAdapter}). A resource that already carries that id stays as it
   * is.
   *
   * The type of the resource an item builds is the first of `tileSet` (a tile set), `atlasUrl` (an
   * atlas) and `imageUrl` (an image) it names. Every other field the item names that this type does
   * not read — an `imageUrl` beside an `atlasUrl`, an `atlasAdapter` on a tile set — is left out
   * and reported in one `error` event of the item, with `source: 'parse'` and its id; the item is
   * built without them. A tile set item without an `imageUrl` is reported the same way and built
   * all the same: it loads no image until an `imageUrl` is written to the resource.
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
   * A listener of `ready`, `resource:<id>` or `error` that throws changes nothing of the parse:
   * every listener hears its event, eventize reports the throw on the console, and `parse()` goes
   * on and returns as usual. What a listener of `ready` starts — `whenReady()`, `whenResource()`,
   * `getAsync()`, `get()`, `acquireAsync()`, `on()` — hears that `ready` behind the last listener
   * of it, ahead of the `resource:<id>` events; should one of them throw as it hears it, the throw
   * is reported on the console as well, and `parse()` goes on. Nor does a subscriber of a resource
   * — of {@link TextureStore.on} among them — that throws while the values are written: every
   * subscriber hears its value, the parse runs to its end, and the throw goes out after
   * `evictMissing` as an `error` event with `source: 'parse'` and no id. `parse()` throws for data
   * it refuses before anything is written or emitted — and for a throw of the loop that writes the
   * items, which leaves the items before it written and emits nothing. A resource that
   * `evictMissing` disposes is removed even when a listener of its `dispose` event throws; that
   * throw goes out as an `error` event with `source: 'parse'` and the id of the resource.
   *
   * On a disposed store this does nothing: no resource is built, and none is updated.
   */
  parse(data: TextureStoreData, options?: TextureStoreParseOptions) {
    if (this.#disposed) return;

    // the shape the steps below read is checked first: data without an items object is
    // refused whole, before anything is written or emitted
    assertTextureStoreData(data);

    const checked = this.#checkItems(data);

    // only a list with a known name left in it replaces the defaults: one that held nothing
    // but typos would otherwise take every default away
    if (checked.defaults?.known.length) {
      this.defaultTextureClasses = checked.defaults.known;
    }

    this.#reportItemProblems(checked);

    const {updatedResources, publishError} = this.#writeItems(data, checked, options?.baseUrl);

    // before ready: a listener of it that asks getAsync() for a refused item hears why
    this.#refusedItems = this.#refusalsWithoutResource(checked);

    // From here on the data is parsed and written, and a listener that throws changes nothing of
    // it: emitSafe() lets every listener hear its event, reports the throw on the console, and the
    // parse goes on to its end — the ready value is retained, every resource is announced, and
    // evictMissing runs. A throw that reached the caller would tell loadAsync() the catalog had
    // failed to parse
    const late: Array<() => void> = [];
    this.#readyLate = late;
    try {
      emitSafe(this, OnReady, this);
      // the subscriptions a listener of ready booked while it went out hear this ready now, as the
      // ones that were there before it did. One of them may book or give back another, so the list
      // is read until it is empty. A throw goes to the console, as emitSafe() reports the throw of a
      // subscription booked before the parse(), and the next one hears this ready all the same
      while (late.length > 0) {
        try {
          late.shift()?.();
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: the report emitSafe() gives a subscription booked before the parse()
          console.error(
            'TextureStore: a subscription that a listener of ready started threw as it heard that ready — parse() goes on',
            error,
          );
        }
      }
    } finally {
      this.#readyLate = undefined;
    }

    for (const resource of updatedResources) {
      emitSafe(this, `${OnResource}:${resource.id}`, resource);
    }

    if (options?.evictMissing) {
      this.#evictMissing(updatedResources);
    }

    // last, once the parse is through: the subscriber has heard its value, and its throw belongs
    // to no item
    if (publishError) {
      reportError(this, {source: 'parse', error: publishError.error});
    }
  }

  // Holds every item against what is already there before the first one is written: a parse
  // either runs whole or not at all, instead of leaving half its resources updated and the ready
  // event behind. Throws the TypeError of the conflicts; writes and emits nothing, so nothing is
  // written or emitted before the conflicts are refused
  #checkItems(data: TextureStoreData): CheckedCatalog {
    const conflicts: string[] = [];
    const items = new Map<string, CheckedItem>();

    for (const [id, item] of Object.entries(data.items)) {
      const checked = this.#checkItem(id, item);
      items.set(id, checked);
      if ('refused' in checked) continue;
      const existing = this.#resources.get(id);
      if (existing && existing.type !== checked.type) {
        conflicts.push(`"${id}" is ${articleOf(existing.type)} "${existing.type}" resource and cannot become "${checked.type}"`);
      }
    }

    if (conflicts.length) {
      throw new TypeError(
        `TextureStore: parse() found ${conflicts.length} item(s) of a conflicting type: ${conflicts.join('; ')}`,
      );
    }

    const defaults = data.defaultTextureClasses === undefined ? undefined : partitionTextureClasses(data.defaultTextureClasses);
    return {defaults, items};
  }

  // What one item builds, or why it builds nothing. The checks come in this order, and the first
  // that refuses decides: the types of its fields, a source, an atlasAdapter this store does not
  // know on an atlas. The type is the first of `tileSet`, `atlasUrl` and `imageUrl` it names
  #checkItem(id: string, item: TextureResourceData): CheckedItem {
    const problems = textureResourceDataProblems(item);
    if (problems.length) {
      return {refused: refusalOf(id, `builds no resource: ${problems.join('; ')}`)};
    }
    const type = item.tileSet ? 'tileset' : item.atlasUrl ? 'atlas' : item.imageUrl ? 'image' : undefined;
    if (type === undefined) {
      return {refused: refusalOf(id, 'names no tileSet, atlasUrl or imageUrl and builds no resource')};
    }
    if (
      type === 'atlas' &&
      item.atlasAdapter !== undefined &&
      !this.#atlasAdapters.some(({name}) => name === item.atlasAdapter)
    ) {
      const known = this.#atlasAdapters.map(({name}) => name).join(', ');
      return {
        refused: refusalOf(
          id,
          `names the atlasAdapter "${item.atlasAdapter}", which this store does not know — known: ${known}; register it with registerAtlasAdapter() before parse()`,
        ),
      };
    }

    const notes: Error[] = [];
    // a field is named when it is there at all, as `undefined` is absent
    const leftOut = TYPE_SPECIFIC_FIELDS.filter((field) => item[field] !== undefined && !FIELDS_READ_BY_TYPE[type].has(field));
    if (leftOut.length) {
      notes.push(
        new Error(
          `TextureStore: item "${id}" builds ${articleOf(type)} "${type}" resource, which reads no ${leftOut.join(', ')} — left out`,
        ),
      );
    }
    // a getAsync() of its image waits until a later parse() names one or an imageUrl is written to the
    // resource: reported, as a forgotten url would leave that wait unexplained, and built all the same,
    // as a placeholder filled in later
    if (type === 'tileset' && !item.imageUrl) {
      notes.push(
        new Error(
          `TextureStore: item "${id}" builds a "tileset" resource without an imageUrl — it loads no image, and a getAsync() of its texture or tile set waits until an imageUrl is written to the resource`,
        ),
      );
    }
    let classes: TextureOptionClasses[] | undefined;
    if (item.texture !== undefined) {
      const {known, unknown} = partitionTextureClasses(item.texture);
      classes = known;
      if (unknown.length) {
        notes.push(
          new Error(
            `TextureStore: item "${id}" names ${listCatalogValues(unknown)} in texture, which no TextureFactory knows — left out`,
          ),
        );
      }
    }
    return {type, classes, notes};
  }

  // The error events of the catalog, in the order of the data: the unknown default classes, which
  // belong to the catalog as a whole and name no item, then each item — why it builds nothing, or
  // what it is built without. emitSafe(): a listener that throws takes the event from no other
  #reportItemProblems({defaults, items}: CheckedCatalog): void {
    if (defaults?.unknown.length) {
      reportError(this, {
        source: 'parse',
        error: new Error(
          `TextureStore: defaultTextureClasses names ${listCatalogValues(defaults.unknown)}, which no TextureFactory knows — left out`,
        ),
      });
    }
    for (const [id, checked] of items) {
      if ('refused' in checked) {
        reportError(this, {source: 'parse', id, error: checked.refused.error});
        continue;
      }
      for (const note of checked.notes) {
        reportError(this, {source: 'parse', id, error: note});
      }
    }
  }

  // Writes every item into its resource, or builds the resource, all in one batch, and answers the
  // resources this run touched in the order of the data — a refused item whose id carries a
  // resource among them, so that it is announced and stays out of `evictMissing`. A subscriber of a
  // resource that throws while the batch flushes is answered as `publishError`, not thrown
  #writeItems(
    data: TextureStoreData,
    {items}: CheckedCatalog,
    baseUrl: string | URL | undefined,
  ): {updatedResources: AnyTextureResource[]; publishError: {error: unknown} | undefined} {
    const updatedResources: AnyTextureResource[] = [];
    let publishError: {error: unknown} | undefined;
    let written = false;

    try {
      batch(() => {
        for (const [id, item] of Object.entries(data.items)) {
          const checked = expectDefined(items.get(id), `the checked item "${id}"`);
          const existing = this.#resources.get(id);

          // the fields of a refused item are never read: `tileSet: 5` would pass for a tile set.
          // A resource that already carries its id is announced all the same and stays out of
          // `evictMissing`
          if ('refused' in checked) {
            if (existing) updatedResources.push(existing);
            continue;
          }

          const textureClasses = joinTextureClasses(this.defaultTextureClasses, checked.classes);
          const resource = this.#writeItem(id, item, existing, textureClasses, baseUrl);
          if (resource) {
            if (!this.#resources.has(id)) this.#adopt(id, resource);
            this.#resources.set(id, resource);
            updatedResources.push(resource);
          }
        }
        written = true;
      });
    } catch (error) {
      // a throw of the loop is no throw of a subscriber: the items after it were never written,
      // and ready and evictMissing must not go out as if they were
      if (!written) throw error;
      // Safe to catch: the nested batch() calls of the items do not flush, so the throw comes out of
      // the flush of this outer one, after the loop has written every item. signalize isolates the
      // throw of each effect, runs all the others and throws one at the end, several as an
      // AggregateError — every subscriber has heard its value. The caught value goes out unchanged,
      // as TextureResource keeps it with its own publishError, and without an id: the flush ties
      // the throw to no item
      publishError = {error};
    }

    return {updatedResources, publishError};
  }

  // The values of one item written into the resource that carries its id, or a resource built from
  // them. A resource that carries the id has the type the item asks for: #checkItems() refused the
  // parse otherwise, so narrowing by `type` picks the branch of the item
  #writeItem(
    id: string,
    item: TextureResourceData,
    existing: AnyTextureResource | undefined,
    textureClasses: TextureOptionClasses[] | undefined,
    baseUrl: string | URL | undefined,
  ): AnyTextureResource | undefined {
    const resolve = (url: string | undefined) => (url === undefined ? undefined : resolveRelativeUrl(url, baseUrl));

    if (item.tileSet) {
      if (existing?.type === 'tileset') {
        batch(() => {
          existing.imageUrl = resolve(item.imageUrl);
          existing.tileSetOptions = item.tileSet;
          existing.textureClasses = textureClasses;
          existing.frameBasedAnimationsData = item.frameBasedAnimations;
        });
        return existing;
      }
      return TextureResource.fromTileSet(id, resolve(item.imageUrl), item.tileSet, textureClasses, item.frameBasedAnimations);
    }
    if (item.atlasUrl) {
      if (existing?.type === 'atlas') {
        batch(() => {
          existing.atlasAdapter = this.#namedAtlasAdapter(item.atlasAdapter);
          existing.atlasUrl = resolve(item.atlasUrl);
          existing.overrideImageUrl = resolve(item.overrideImageUrl);
          existing.textureClasses = textureClasses;
          existing.frameBasedAnimationsData = item.frameBasedAnimations;
        });
        return existing;
      }
      const created = TextureResource.fromAtlas(
        id,
        resolveRelativeUrl(item.atlasUrl, baseUrl),
        resolve(item.overrideImageUrl),
        textureClasses,
        item.frameBasedAnimations,
      );
      created.atlasAdapter = this.#namedAtlasAdapter(item.atlasAdapter);
      return created;
    }
    if (item.imageUrl) {
      if (existing?.type === 'image') {
        batch(() => {
          existing.imageUrl = resolve(item.imageUrl);
          existing.textureClasses = textureClasses;
        });
        return existing;
      }
      return TextureResource.fromImage(id, resolveRelativeUrl(item.imageUrl, baseUrl), textureClasses);
    }
    return undefined;
  }

  // A resource built by this parse joins the store
  #adopt(id: string, resource: AnyTextureResource): void {
    // the image source goes in before anything can run the image effect: its first run
    // fetches the image, with or without a factory, and an image source set afterwards
    // would miss that fetch
    resource[imageSource] ??= this.#imageSource;
    if (resource.type === 'atlas') resource[atlasAdapterPicker] ??= this.#pickAtlasAdapter;
    resource.textureFactory = this.#textureFactory.value;
    // A resource disposed directly leaves the store, so that the next parse() naming its id
    // builds a new one instead of writing into a resource that answers nothing any more. At
    // Priority.Max the map is clean before the followers of on() and getAsync() hear the
    // dispose and follow the id anew. clearUnused() and evictMissing take the resource out
    // before they dispose it, and dispose() of the store sets #disposed first: this listener
    // finds nothing to do then
    once(resource, TextureResourceEvents.Dispose, Priority.Max, () => {
      if (!this.#disposed && this.#resources.get(id) === resource) this.#resources.delete(id);
    });
  }

  // the refusals of this parse whose id carries no resource now: a refused item leaves a resource
  // that already carries its id standing, and a later direct dispose of that one gives no reason
  #refusalsWithoutResource({items}: CheckedCatalog): Map<string, ItemRefusal> {
    const refusals = new Map<string, ItemRefusal>();
    for (const [id, checked] of items) {
      if ('refused' in checked && !this.#resources.has(id)) refusals.set(id, checked.refused);
    }
    return refusals;
  }

  // Disposes and removes every resource this run did not touch whose refCount is 0. The set comes
  // from the resources this run touched, not from the data keys: an item that names no source or
  // carries a field of the wrong type builds no resource, yet leaves an existing one in place —
  // and that one is in `updatedResources`
  #evictMissing(updatedResources: readonly AnyTextureResource[]): void {
    const keep = new Set(updatedResources.map((resource) => resource.id));
    for (const [id, resource] of this.#resources) {
      if (keep.has(id) || resource.refCount > 0) continue;
      // removed before it is disposed: a dispose listener that throws leaves no disposed
      // resource behind in the store, and the throw goes out as an error of this parse
      this.#resources.delete(id);
      try {
        resource.dispose();
      } catch (error) {
        reportError(this, {source: 'parse', id, error});
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
   * A resource that is disposed directly leaves the store, and the subscription follows the
   * resource the next `parse()` builds under the id. A subtype the type of the resource never
   * builds is reported once on the console.
   *
   * On a disposed store this does nothing: the callback is never called, and the returned
   * unsubscribe function has nothing to take back.
   */
  on<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    callback: (val: MapSubTypes<T>) => void,
  ): () => void {
    return this.#subscribe(id, type, (value) => callback(value), true);
  }

  // The body of on(), which getAsync() and acquireAsync() subscribe through as well: `callback` is
  // handed the resource the value came from beside it, so that acquireAsync() holds exactly that
  // one. Only on() warns about a subtype the type of its resource never builds — the promises
  // reject on it instead
  #subscribe<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    callback: (value: MapSubTypes<T>, resource: TextureResource) => void,
    warnOutOfReach: boolean,
  ): () => void {
    if (this.#disposed) return () => {};

    const follower = this.#followerOf(id);

    // the follower starts with the first ready: the values of a subscription come while ready goes
    // out, ahead of the resource:<id> events
    const unsubscribeFromReady = this.#onReadyOnce(() => {
      follower.follow((resource, hold) => this.#subscribeToResource(id, type, callback, warnOutOfReach, resource, hold));
    });

    const unsubscribe = (): void => {
      follower.dispose();
      // the handle releases exactly this subscription; off(this, OnReady, …) would take the
      // store's retained ready value with it and leave every later subscriber waiting
      unsubscribeFromReady();
      unsubscribeFromDispose();
    };
    const unsubscribeFromDispose = once(this, OnDispose, unsubscribe);

    return unsubscribe;
  }

  // What a subscription does with each instance its follower hands it: the instance gets the image
  // source and the atlas adapter picker of this store and its factory, is activated and held, and
  // the subtypes are subscribed. Everything that has to be given back is booked through `hold`, so
  // the follower gives it back when the instance goes
  #subscribeToResource<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    callback: (value: MapSubTypes<T>, resource: TextureResource) => void,
    warnOutOfReach: boolean,
    resource: AnyTextureResource,
    hold: (release: () => void) => void,
  ): void {
    resource[imageSource] ??= this.#imageSource;
    if (resource.type === 'atlas') resource[atlasAdapterPicker] ??= this.#pickAtlasAdapter;
    resource.activate();
    if (this.#textureFactory.value && !resource.textureFactory) {
      resource.textureFactory = this.#textureFactory.value;
    }

    const subTypes = (Array.isArray(type) ? type : [type]) as readonly TextureResourceSubType[];

    // by the type alone: a later parse() may still bring the animation data, and on() lives that
    // long. The follower hands over each instance once, so each is named once — and a resource of
    // another type that takes the place of this one is asked again
    if (warnOutOfReach) {
      const never = resource[subTypesOutOfReach](subTypes, 'type');
      if (never.length) {
        // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
        console.warn(
          `TextureStore: on(${describeValue(id)}, ${describeValue(type)}) is never called for "${id}": it is ${articleOf(resource.type)} "${resource.type}" resource, which never builds ${never.join(', ')}`,
        );
      }
    }

    resource[changeRefCount](1);
    hold(() => {
      resource[changeRefCount](-1);
    });

    if (!Array.isArray(type)) {
      hold(
        on(resource, type as TextureResourceSubType, (val) => {
          // the same filter the tuple path applies: a signal that is cleared and notifies
          // would otherwise hand the callback an undefined where its type promises a
          // value — and getAsync() would resolve with it
          if (val == null) return;
          callback(val as MapSubTypes<T>, resource);
        }),
      );
      return;
    }

    // the tuple this instance last delivered, so the several events of one batch deliver it once
    let lastValues: unknown[] | undefined;
    for (const subType of subTypes) {
      hold(
        on(resource, subType, () => {
          // the tuple is read off the resource, not collected from the values the
          // events carried: values that belong together are written in one batch,
          // while the events announcing them arrive one after the other. A tuple
          // assembled from the last event of each subtype would pair a fresh atlas
          // with the texture of the image before it.
          //
          // The other half of that contract lives in the resource: the effects that
          // derive from an image run at a higher priority than the bridges that emit,
          // so no event of such a batch finds a value of the run before it
          const valuesArg = subTypes.map((t) => resource[t]).filter((v) => v != null);
          if (valuesArg.length !== subTypes.length) return;
          // and because every event of such a batch reads the same finished tuple,
          // the callback would otherwise be called once per event with it
          if (lastValues?.every((value, index) => value === valuesArg[index])) return;
          lastValues = valuesArg;
          callback(valuesArg as MapSubTypes<T>, resource);
        }),
      );
    }
  }

  /**
   * Resolve with the value (or tuple of values) of the given subtype(s) as soon as the
   * resource `id` has them. On a store without a renderer, `texture` waits until one is set.
   *
   * A promise still pending when {@link TextureStore.dispose} runs is rejected, and a
   * call on a store that is already disposed is rejected right away. An id that is
   * still missing once the first `parse()` has gone by is rejected with the same error
   * {@link TextureStore.whenResource} throws, instead of waiting for a later `parse()`. For an id
   * whose item the last `parse()` refused, that error says why and carries the error of the
   * `error` event of that item as its `cause`.
   *
   * It is rejected as well when the resource reports a failure that keeps a value it asks
   * for from arriving: an image that does not load, an atlas json that cannot be fetched or
   * read or that names no image, a texture that cannot be built — and, for `tileSet`,
   * `atlas` and `frameBasedAnimations`, tile set options that `TileSet` refuses or an atlas
   * json that its atlas adapter cannot read. A failure reported before the call counts as
   * well, until a change of what the failed step reads — its url, its options, the texture
   * classes, the renderer — sends that step off again, or an `atlasJson` written to the
   * resource takes the place of one that could not be fetched or is still being fetched. The
   * error names the step and the url, and carries what the resource reported as its `cause`.
   * An animation entry that is skipped does not reject, and neither does a subscriber of the
   * resource that throws: the value it was handed is there.
   *
   * It is rejected for a subtype the resource can never build, too: by its type — an `image`
   * builds `imageCoords` and `texture` alone, an `atlas` builds no `tileSet` — or because it
   * carries no animation data and its atlas adapter reads no animations out of its json. And it is
   * rejected when the resource it waits on is disposed directly.
   *
   * The value is borrowed: the promise gives its hold on the resource back as it settles, so
   * `clearUnused()`, `parse({evictMissing: true})` and a change of the renderer or of the texture
   * classes may release it while it sits in a material. {@link TextureStore.acquireAsync} holds it.
   */
  getAsync<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    options?: {signal?: AbortSignal},
  ): Promise<MapSubTypes<T>> {
    return this.#getOnce('getAsync', id, type, options, false);
  }

  /**
   * Resolve as {@link TextureStore.getAsync} does, with a {@link TextureStoreLease}: the value
   * (or tuple of values) of the given subtype(s), and a hold on the resource it came from until
   * `release()` is called. While it is held, {@link TextureStore.clearUnused} and
   * `parse({evictMissing: true})` leave the resource standing.
   *
   * The resource is held, not the value: a new renderer, other texture classes or another image
   * make it build a new texture and release the old one. Whoever wants to follow that subscribes
   * with {@link TextureStore.on}. {@link TextureStore.dispose} releases everything, held resources
   * among it; a `release()` afterwards does no harm.
   *
   * It is rejected where `getAsync()` is rejected — on a disposed store, for an id that is missing,
   * on an abort, on a failure of the resource, for a subtype the resource never builds and for a
   * resource disposed while it waits —, and its messages name `acquireAsync()`.
   */
  acquireAsync<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    options?: {signal?: AbortSignal},
  ): Promise<TextureStoreLease<MapSubTypes<T>>> {
    return this.#getOnce('acquireAsync', id, type, options, true);
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
    return this.#getOnce('get', id, type, options, false);
  }

  // the body of getAsync(), of its alias and of acquireAsync(); every message names the method the
  // caller wrote, so that it leads back to the line it came from. With `asLease` the promise
  // resolves with a lease that holds the resource the value came from
  #getOnce<const T extends TextureResourceSubType | readonly TextureResourceSubType[], H extends boolean>(
    method: 'get' | 'getAsync' | 'acquireAsync',
    id: string,
    type: T,
    options: {signal?: AbortSignal} | undefined,
    asLease: H,
  ): Promise<H extends true ? TextureStoreLease<MapSubTypes<T>> : MapSubTypes<T>> {
    const signal = options?.signal;
    const what = `${method}(${describeValue(id)}, ${describeValue(type)})`;
    return new Promise((resolve, reject) => {
      if (this.#disposed) {
        reject(disposedError(what));
        return;
      }
      if (signal?.aborted) {
        reject(new DOMException(`TextureStore: ${what} aborted before subscription`, 'AbortError'));
        return;
      }

      const settlement = new Settlement();

      // the one way this promise rejects; once it has settled, this does nothing
      const giveUp = (error: Error) => {
        if (settlement.settle()) reject(error);
      };

      const onAbort = () => giveUp(new DOMException(`TextureStore: ${what} aborted`, 'AbortError'));

      settlement.track(
        this.#subscribe(
          id,
          type,
          (value, resource) => {
            if (!asLease) {
              settlement.settle();
              resolve(value as never);
              return;
            }
            // the hold goes on before settle() gives back the count of the subscription of this
            // promise, so the resource is held all the way through
            const lease = leaseOn(value, resource);
            settlement.settle();
            resolve(lease as never);
          },
          false,
        ),
      );

      // a failure the resource reported before this call counts like one that arrives while
      // waiting: the step that failed does not run again by itself. A value on() delivers
      // synchronously wins, because on() subscribes first: a settled promise disposes the
      // follower before it starts
      const subTypes = (Array.isArray(type) ? type : [type]) as readonly TextureResourceSubType[];
      const follower = this.#followerOf(id);
      settlement.track(() => follower.dispose());
      follower.follow((resource, hold) => this.#watchResource(what, id, subTypes, resource, hold, giveUp));

      settlement.track(once(this, OnDispose, () => giveUp(disposedError(what))));

      // on() keeps waiting for a later parse(); getAsync() answers like whenResource() and gives
      // up once the first ready has gone by without the id showing up
      settlement.track(
        this.#onReadyOnce(() => {
          if (this.#resources.has(id)) return;
          giveUp(noResourceError(id, this.#refusedItems.get(id)));
        }),
      );

      // the promise may already have settled synchronously; a listener installed now would sit
      // on the caller's signal until that signal aborts — one per such getAsync() on a long-lived
      // AbortController
      if (signal && !settlement.settled) {
        signal.addEventListener('abort', onAbort, {once: true});
        settlement.track(() => signal.removeEventListener('abort', onAbort));
      }
    });
  }

  // What a getAsync() watches on each instance of its resource the follower hands it, and gives up
  // on: a failure that keeps a value it asks for from arriving, a subtype the instance never builds,
  // a dispose of the instance. Every listener is booked through `hold`
  #watchResource(
    what: string,
    id: string,
    subTypes: readonly TextureResourceSubType[],
    resource: AnyTextureResource,
    hold: (release: () => void) => void,
    giveUp: (error: Error) => void,
  ): void {
    const rejectIfHeldBack = () => {
      const failure = resource[loadFailureFor](subTypes);
      if (failure != null) giveUp(resourceFailedError(what, failure));
    };
    // a subtype the resource never builds would leave the promise waiting for good
    const rejectIfOutOfReach = () => {
      if (resource[subTypesOutOfReach](subTypes, 'now').length) giveUp(outOfReachError(what, resource, subTypes));
    };
    hold(on(resource, TextureResourceEvents.Error, rejectIfHeldBack));
    rejectIfHeldBack();
    rejectIfOutOfReach();
    // whether the adapter of an atlas reads animations out of its json is known once the atlas
    // is there: the resource writes the atlas and the animations of the adapter in one batch
    if (resource.type === 'atlas' && subTypes.includes('frameBasedAnimations')) {
      hold(on(resource, TextureResourceEvents.Atlas, rejectIfOutOfReach));
    }
    // a dispose of the store goes out before its resources are disposed, so its message comes first
    hold(once(resource, TextureResourceEvents.Dispose, () => giveUp(resourceDisposedError(what, id))));
  }

  /**
   * Dispose all resources whose `refCount` is 0 and remove them from the store.
   * Returns the number of resources that were cleared.
   *
   * A listener of the `dispose` event of a resource that throws holds up none of the others:
   * every unused resource is disposed and removed, and the throw goes on to the caller
   * afterwards — several as an `AggregateError`.
   *
   * On a disposed store this does nothing and answers 0.
   */
  clearUnused(): number {
    let removed = 0;
    const errors: unknown[] = [];
    for (const [id, resource] of this.#resources) {
      if (resource.refCount <= 0) {
        // removed before it is disposed: a dispose listener that throws leaves no disposed
        // resource behind in the store and keeps the others from nothing
        this.#resources.delete(id);
        removed++;
        try {
          resource.dispose();
        } catch (error) {
          errors.push(error);
        }
      }
    }
    throwCollected(errors, 'TextureStore#clearUnused(): listeners of the dispose events of the resources it cleared threw');
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
   * {@link TextureStore.parse}, {@link TextureStore.on}, {@link TextureStore.onResource},
   * {@link TextureStore.registerAtlasAdapter} and a write to `renderer` do nothing, and
   * {@link TextureStore.clearUnused} answers 0. {@link TextureStore.defaultTextureClasses} keeps its
   * last value.
   *
   * A listener of the `dispose` event of this store or of one of its resources that throws does
   * not hold up the teardown: every pending promise is rejected, every resource is disposed,
   * and the throw goes on to the caller afterwards — several as an `AggregateError`.
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;

    // the listeners are still attached here: this event is what tells them to let go,
    // and off(this) below is what makes it the last event this store ever emits — the
    // clean-up underneath gives the renderer up, and the change bridge would otherwise
    // follow the dispose event with a rendererChanged. A listener that throws does not hold up
    // the teardown: its error waits until the store is down, so a caller that catches it holds
    // a disposed store, not half of one
    const errors: unknown[] = [];
    try {
      emitStrict(this, OnDispose);
    } catch (error) {
      errors.push(error);
    }
    off(this);

    // before the resources go: no catalog fetch of this store outlives this call, and no
    // loadAsync() is left waiting for one
    this.#disposal.abort();

    for (const resource of this.#resources.values()) {
      try {
        resource.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    this.#resources.clear();
    this.#images.clear();
    this.#refusedItems.clear();

    this.#renderer.set(undefined);
    SignalGroup.delete(this);

    throwCollected(errors, 'TextureStore#dispose(): listeners of the dispose events of the store and of its resources threw');
  }
}
