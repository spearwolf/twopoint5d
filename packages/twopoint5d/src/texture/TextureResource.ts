import {emitSafe, emitStrict, type EventizedObject, eventize, off, retain, retainClear} from '@spearwolf/eventize';
import type {Signal} from '@spearwolf/signalize';
import {batch, createEffect, createSignal, SignalGroup, touch} from '@spearwolf/signalize';
import type {WebGPURenderer} from 'three/webgpu';
import {ImageLoader, type Texture} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {throwCollected} from '../utils/throwCollected.js';
import {FrameBasedAnimations} from './FrameBasedAnimations.js';
import {cmpAnimationsData} from './cmpAnimationsData.js';
import {type AtlasJsonFetch, fetchAtlasJson} from './fetchAtlasJson.js';
import {type AtlasAdapter, builtInAtlasAdapters, pickAtlasAdapter} from './atlasAdapters.js';
import {
  atlasAdapterPicker,
  changeRefCount,
  imageSource,
  type ImageLease,
  loadFailureFor,
  subTypesOutOfReach,
  type TextureImageSource,
  type TextureResourceLoadFailure,
} from './internals.js';
import type {AtlasJsonResponse} from './isAtlasJsonResponse.js';
import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import type {TexturePackerJsonData} from './TexturePackerJson.js';
import {TileSet, type TileSetOptions} from './TileSet.js';
import type {FrameBasedAnimationsData, FrameBasedAnimationsDataMap} from './types.js';

type FrameBasedAnimationsDataShape = 'frameNameQuery' | 'tileIds' | 'firstTileId';

// what an atlas adapter answers, as the resource checks it
interface AtlasAdapterResultShape {
  atlas: unknown;
  animations: unknown;
}

/**
 * Which of the three forms of animation data this entry carries, or `undefined` for an
 * entry that carries none of them. An entry that is no object — `null`, a number, a string
 * out of the catalog json — carries none of them either.
 */
const animationDataShape = (data: unknown): FrameBasedAnimationsDataShape | undefined => {
  if (typeof data !== 'object' || data === null) return undefined;
  if ('frameNameQuery' in data) return 'frameNameQuery';
  if ('tileIds' in data) return 'tileIds';
  if ('firstTileId' in data) return 'firstTileId';
  return undefined;
};

export type TextureResourceType = 'image' | 'atlas' | 'tileset';
export type TextureResourceSubType = 'imageCoords' | 'atlas' | 'tileSet' | 'texture' | 'frameBasedAnimations';

/**
 * Constants for the subtypes emitted by `TextureResource` (and accepted by `TextureStore.on(id, type, ...)`).
 *
 * Prefer these over raw string literals when subscribing — the values are
 * declared as a `const`-typed record so they remain assignable to
 * `TextureResourceSubType`.
 */
export const TextureResourceSubtypes = {
  ImageCoords: 'imageCoords',
  Atlas: 'atlas',
  TileSet: 'tileSet',
  Texture: 'texture',
  FrameBasedAnimations: 'frameBasedAnimations',
} as const satisfies Record<string, TextureResourceSubType>;

/**
 * Public event-name constants emitted by `TextureResource`.
 *
 * - `imageCoords`, `atlas`, `tileSet`, `texture` and `frameBasedAnimations` carry the values of the
 *   resource and are retained: a late subscriber sees the latest value.
 *   - A value the resource takes back is not announced: rather than carrying `undefined`, its
 *     retained event is cleared, and a subscriber that arrives later waits for the next value.
 *     {@link TextureResource} lists when a value is taken back.
 *   - A subscriber that throws keeps the value from no one: every other subscriber is called and
 *     the retained value is written before the throw goes on.
 * - `error` carries one payload per `source`:
 *   - `{source: 'image', url, error}` — an image that does not load. The failure comes out of the
 *     loader promise and has no status to name.
 *   - `{source: 'atlas', url, status, error}` — an atlas request that answered with a status
 *     instead of a body.
 *   - `{source: 'atlas', url, error}`, with no `status` — a fetch of the atlas json that failed; a
 *     response that is no texture atlas json; a json that names no image and was given no
 *     `overrideImageUrl` to fall back on, or whose `overrideImageUrl` is cleared again. Such a
 *     response was a 200, so there is no status to name.
 *   - `{source: 'texture', id, error}`, with no `url`, since none has failed — a failure behind an
 *     image that loaded successfully:
 *     - the texture cannot be built, or a value derived from it, such as an atlas or a tile set;
 *     - a throw raised while the resource publishes what it loaded — its image, its atlas json and
 *       what is built from them. The value stays published, and `TextureStore#getAsync()` does not
 *       reject on it;
 *     - a tile set that `TileSet` refuses, whether the image arrives or the `tileSetOptions`
 *       change. The write that changed them does not throw;
 *     - an `atlasJson` that its atlas adapter cannot read, as soon as the image it names is there.
 *       The write that set it does not throw either.
 *   - `{source: 'frameBasedAnimations', id, animation, error}` — an animation entry that is skipped.
 *     Every other entry of the same map is registered all the same. An entry is skipped
 *     - whose data is no object or does not fit this kind of resource;
 *     - whose data does not let the animation be built: no `duration` and no `frameRate`, a
 *       `frameRate` of 0, `tileIds` that are no array, a tile id, a `firstTileId` or a `tileCount`
 *       that `FrameBasedAnimations#add()` refuses, a `frameNameQuery` that is neither a string nor
 *       a `RegExp`;
 *     - whose frames come out empty: a `frameNameQuery` that matches nothing or an empty list of
 *       `tileIds`.
 *   - A listener that throws takes the event from no other listener: eventize reports the throw on
 *     the console, and the resource goes on as it would without it — the other entries of an
 *     animation map are registered, and a `TextureStore#getAsync()` that waits on the resource
 *     hears the failure.
 * - `dispose` fires once at the start of `dispose()`. Every listener hears it, even behind one that
 *   throws.
 */
export const TextureResourceEvents = {
  ImageCoords: TextureResourceSubtypes.ImageCoords,
  Atlas: TextureResourceSubtypes.Atlas,
  TileSet: TextureResourceSubtypes.TileSet,
  Texture: TextureResourceSubtypes.Texture,
  FrameBasedAnimations: TextureResourceSubtypes.FrameBasedAnimations,
  Dispose: 'dispose',
  Error: 'error',
} as const;

const cmpTexClasses = (a: TextureOptionClasses[] | undefined, b: TextureOptionClasses[] | undefined): boolean => {
  if (a === b) {
    return true;
  }
  return `${a?.join() ?? ''}` === `${b?.join() ?? ''}`;
};

// Compares every own enumerable field of both objects, so a field added to TextureCoords
// or TileSetOptions is part of the comparison the day it appears. The two key sets are
// unioned because an optional field that was never assigned is not an own key under
// `useDefineForClassFields: false` — `TextureCoords#parent` is exactly that case.
const cmpShallow = <T extends object>(a: T | undefined, b: T | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
};

const OnDispose = TextureResourceEvents.Dispose;
const OnError = TextureResourceEvents.Error;

// Everything derived from an image runs before the bridges that carry the values out as
// events, which have no priority and sit at 0. The image effect writes the coordinates and
// the texture in one batch, so by the time a subscriber is called for the texture, the
// atlas or the tile set built from the same image is on the resource. Without a priority
// the flush would fall back to the order the effects were queued in — the order of three
// lines inside one callback, which no one reading them would take for a promise.
// The tile set effect is the one the suite can tell apart: it hangs off `#imageCoords`
// alone and is registered after the bridge that carries the coordinates out, so without
// the priority the bridge goes first. The atlas effect also reads `#imageUrlOfCoords`,
// the first write of the batch, which queues it ahead of every bridge on its own — its
// priority is what keeps the promise once those three lines are ever reordered.
const DERIVED_FROM_IMAGE_PRIORITY = 100;

type LoadStep = 'image' | 'atlasFetch' | 'atlasImage' | 'tileSet' | 'atlasParse';

const ALL_SUBTYPES: readonly TextureResourceSubType[] = Object.values(TextureResourceSubtypes);

// what a step that ended in a failure keeps from arriving: an image, an atlas json or a
// texture that is not there takes everything with it, while a tile set or an atlas json
// that is refused leaves the texture and the coordinates of the image standing
const SUBTYPES_HELD_BACK_BY_STEP: Record<LoadStep, readonly TextureResourceSubType[]> = {
  image: ALL_SUBTYPES,
  atlasFetch: ALL_SUBTYPES,
  atlasImage: ALL_SUBTYPES,
  tileSet: ['tileSet', 'atlas', 'frameBasedAnimations'],
  atlasParse: ['atlas', 'frameBasedAnimations'],
};

// what each type of resource builds at all: activate() registers the image effect alone for an
// image, the tile set effects set `tileSet` and `atlas` and register the animations, and the atlas
// effects set `atlas` and register the animations, but never a `tileSet`
const SUBTYPES_BUILT_BY_TYPE: Record<TextureResourceType, readonly TextureResourceSubType[]> = {
  image: ['imageCoords', 'texture'],
  tileset: ['imageCoords', 'texture', 'tileSet', 'atlas', 'frameBasedAnimations'],
  atlas: ['imageCoords', 'texture', 'atlas', 'frameBasedAnimations'],
};

// An animation entry that carries the data of another kind of resource is skipped — a tile
// range on an atlas, a frame name query on a tile set, or an entry that names no frames at
// all — and this is the error it is skipped with.
const wrongAnimationDataError = (resource: TextureResource, animation: string, shape: string | undefined): Error =>
  new Error(
    `TextureResource: animation "${animation}" of resource "${resource.id}" carries ${shape ?? 'no known'} data, ` +
      `which a "${resource.type}" resource cannot use`,
  );

// Only the shape of resource a property belongs to carries the signal behind it. TypeScript refuses
// the write, since no type of another shape names the property; JavaScript would quietly create an
// own property the resource never reads, and reading it back would answer the value written, leaving
// the caller with no sign that the value never arrived. The accessors of `refuseInputsOfOtherShapes()`
// throw this instead.
const wrongShapeError = (resource: TextureResource, property: string): TypeError => {
  const article = /^[aeiou]/.test(resource.type) ? 'an' : 'a';
  return new TypeError(`TextureResource "${resource.id}" is ${article} "${resource.type}" resource and has no "${property}"`);
};

// An atlas resource takes the name of its image from its json. Writing that name from
// outside would put the texture on one file while the atlas keeps describing another, and
// nothing would ever bring the two back together: the json still names what it named, so
// the atlas effect finds no reason to publish again and no error is raised either. TypeScript
// refuses the write, `imageUrl` of an atlas is read-only; for JavaScript, which would quietly
// create an own property the resource never reads, the setter on the prototype throws this.
const derivedImageUrlError = (resource: TextureResource): TypeError =>
  new TypeError(
    `TextureResource "${resource.id}" is an "atlas" resource and takes its "imageUrl" from the atlas json ` +
      `— write "overrideImageUrl" instead`,
  );

// a resource on its own picks among the built-in adapters by `meta.app`
const BUILT_IN_ATLAS_ADAPTERS = builtInAtlasAdapters();
const pickBuiltInAtlasAdapter = (json: TexturePackerJsonData): AtlasAdapter => pickAtlasAdapter(BUILT_IN_ATLAS_ADAPTERS, json);

// `url` is the url this json came from — `atlasUrl` may already name the next one
interface FetchedAtlasJson {
  readonly json: AtlasJsonResponse;
  readonly url: string;
}

// What the class of a shape reaches of the base: the signals of the base its inputs and effects
// read and write, and the parts of the load bookkeeping a shape takes part in. The base builds it
// once in its constructor, and `shapeContextOf()` hands it to the class of the shape — neither is
// exported, so nothing outside this module reaches it.
interface ShapeContext {
  readonly imageUrl: Signal<string | undefined>;
  readonly imageCoords: Signal<TextureCoords | undefined>;
  readonly imageUrlOfCoords: Signal<string | undefined>;
  readonly atlas: Signal<TextureAtlas | undefined>;
  readonly tileSet: Signal<TileSet | undefined>;
  readonly frameBasedAnimations: Signal<FrameBasedAnimations | undefined>;
  readonly adapterAnimations: Signal<FrameBasedAnimations | undefined>;
  readonly frameBasedAnimationsData: Signal<FrameBasedAnimationsDataMap | undefined>;
  isDisposed(): boolean;
  clearFailure(step: LoadStep): void;
  fail(step: LoadStep, failure: TextureResourceLoadFailure): void;
  registerAnimationsEffect<S extends TileSet | TextureAtlas>(
    source: Signal<S | undefined>,
    addEntry: (animations: FrameBasedAnimations, name: string, data: FrameBasedAnimationsData, source: S) => void,
    baseAnimations?: Signal<FrameBasedAnimations | undefined>,
  ): void;
}

// assigned by the `static {}` block of TextureResource, the one place that reads its `#context`:
// that is how a `#` field gets a friend
let shapeContextOf: (resource: TextureResource) => ShapeContext;

export interface TextureResource extends EventizedObject {}

/**
 * A single entry of a `TextureStore`: an image, a tile set or a texture atlas, turned into a
 * `Texture` and whatever else its shape brings with it. The base of the three classes of resource,
 * one per shape:
 *
 * - {@link ImageTextureResource} — an image;
 * - {@link TileSetTextureResource} — an image cut into tiles;
 * - {@link AtlasTextureResource} — a texture atlas json and the image it names.
 *
 * Each class carries the inputs of its shape alone; {@link AnyTextureResource} is their union, and
 * `type` narrows it to the class. Build one with its constructor, or with
 * {@link TextureResource.fromImage}, {@link TextureResource.fromTileSet} or
 * {@link TextureResource.fromAtlas}, which write its first values as well.
 *
 * `TextureResource` is the base of these three alone and is not meant to be extended outside the
 * library: the effects of a shape hang on a member the published types leave out. To add to a
 * shape, extend the class of that shape.
 *
 * **Inputs** of every shape — write these to say how the texture is built:
 *
 * - `textureClasses` — the texture classes the texture is built with;
 * - `textureFactory` — the factory that builds it; a `TextureStore` writes its shared one;
 * - `renderer` — the renderer a resource on its own builds a factory for.
 *
 * The inputs that say what the resource is made of belong to the class of its shape: `imageUrl`,
 * `tileSetOptions`, `atlasUrl`, `atlasJson`, `overrideImageUrl`, `atlasAdapter` and
 * `frameBasedAnimationsData`.
 *
 * **Outputs** — read-only, produced by the effects {@link TextureResource.activate} registers. Each
 * of them is also an event of the same name, retained, so a subscriber that arrives late still sees
 * the current value:
 *
 * - `imageCoords` — the coordinates of the whole image;
 * - `texture` — the texture built from the image;
 * - `tileSet` — the tile set of a tile set resource;
 * - `atlas` — the atlas of an atlas resource, and the atlas of the tile set of a tile set resource;
 * - `frameBasedAnimations` — the animations of a tile set or an atlas resource.
 *
 * A shape that never builds an output narrows its getter to `undefined`.
 *
 * **What is taken back, and when.** The getter answers `undefined`, and rather than announcing
 * `undefined` the retained event is cleared, so a subscriber that arrives later waits for the next
 * value.
 *
 * - An image or a tile set resource whose `imageUrl` is cleared takes its `imageCoords` and its
 *   `texture` back, together with everything built from them — the `tileSet`, its `atlas` and the
 *   `frameBasedAnimations` — and releases the texture it built, since a subscriber only borrows it.
 * - An image that is still loading when the url is cleared builds nothing.
 * - An atlas resource whose json names no image, with no `overrideImageUrl` to fall back on, has no
 *   `imageUrl` either and does the same.
 * - A tile set resource takes its `tileSet`, `atlas` and `frameBasedAnimations` back while its
 *   `tileSetOptions` are cleared or refused by `TileSet`. The texture stays.
 * - An atlas resource takes its `atlas` and `frameBasedAnimations` back while its `atlasJson` is
 *   cleared, or cannot be read once the image it names is there. The texture stays.
 * - A tile set resource takes its `frameBasedAnimations` back while its `frameBasedAnimationsData`
 *   is cleared, and an atlas resource while that data is cleared and its atlas adapter read no
 *   animations out of the json.
 *
 * **Without a texture factory:**
 *
 * - the resource loads its image all the same and publishes its `imageCoords` and what is built
 *   from them — the `atlas`, the `tileSet` and the `frameBasedAnimations`; only the `texture` waits
 *   for a factory;
 * - a factory that is cleared leaves the texture it built standing for as long as the image stays
 *   the same;
 * - a texture built from another image than the one loaded now is taken back and released.
 */
export abstract class TextureResource {
  static fromImage(id: string, imageUrl: string, textureClasses?: TextureOptionClasses[]): ImageTextureResource {
    const resource = new ImageTextureResource(id);

    batch(() => {
      resource.imageUrl = imageUrl;
      resource.textureClasses = textureClasses?.slice();
    });

    return resource;
  }

  static fromTileSet(
    id: string,
    imageUrl: string | undefined,
    tileSetOptions: TileSetOptions,
    textureClasses?: TextureOptionClasses[],
    frameBasedAnimations?: FrameBasedAnimationsDataMap,
  ): TileSetTextureResource {
    const resource = new TileSetTextureResource(id);

    batch(() => {
      resource.imageUrl = imageUrl;
      resource.tileSetOptions = tileSetOptions;
      resource.textureClasses = textureClasses?.slice();
      resource.frameBasedAnimationsData = frameBasedAnimations;
    });

    return resource;
  }

  static fromAtlas(
    id: string,
    atlasUrl: string,
    overrideImageUrl?: string,
    textureClasses?: TextureOptionClasses[],
    frameBasedAnimations?: FrameBasedAnimationsDataMap,
  ): AtlasTextureResource {
    const resource = new AtlasTextureResource(id);

    batch(() => {
      resource.atlasUrl = atlasUrl;
      resource.overrideImageUrl = overrideImageUrl;
      resource.textureClasses = textureClasses?.slice();
      resource.frameBasedAnimationsData = frameBasedAnimations;
    });

    return resource;
  }

  static {
    shapeContextOf = (resource) => resource.#context;
  }

  // outputs sit on every resource, like the texture: a shape that builds no atlas or no tile
  // set leaves them `undefined`
  #atlas = createSignal<TextureAtlas | undefined>(undefined, {attach: this});
  #tileSet = createSignal<TileSet | undefined>(undefined, {attach: this});

  #frameBasedAnimations = createSignal<FrameBasedAnimations | undefined>(undefined, {attach: this});
  // the animations the atlas adapter read out of the json, published beside the atlas; the catalog
  // entries of the resource are added to a copy of them
  #adapterAnimations = createSignal<FrameBasedAnimations | undefined>(undefined, {attach: this});
  // compared by content: the same catalog parsed again writes new objects of the same data, and
  // keeps the animations built from it
  #frameBasedAnimationsData = createSignal<FrameBasedAnimationsDataMap | undefined>(undefined, {
    compare: cmpAnimationsData,
    attach: this,
  });

  #textureClasses = createSignal<TextureOptionClasses[] | undefined>(undefined, {compare: cmpTexClasses, attach: this});
  // an input of an image and a tile set resource, derived from the json of an atlas resource
  #imageUrl = createSignal<string | undefined>(undefined, {attach: this});
  #imageCoords = createSignal<TextureCoords | undefined>(undefined, {compare: cmpShallow, attach: this});

  // the image url the published `imageCoords` and `texture` were built from, written in the
  // same batch as both of them. The atlas effect holds it against the image its json names,
  // so an atlas and the texture beside it never describe two different files. A signal and
  // not a plain field, because it is what tells that effect to try again: two images of the
  // same size leave `imageCoords` unchanged, and a run the guard skipped would never be
  // taken up again
  #imageUrlOfCoords = createSignal<string | undefined>(undefined, {attach: this});

  #textureFactory = createSignal<TextureFactory | undefined>(undefined, {attach: this});
  #texture = createSignal<Texture | undefined>(undefined, {attach: this});
  #renderer = createSignal<WebGPURenderer | undefined>(undefined, {attach: this});

  readonly #context: ShapeContext;

  /** The id a `TextureStore` carries this resource under; it still answers after {@link TextureResource.dispose}. */
  readonly id: string;
  /** The shape of this resource; it still answers after {@link TextureResource.dispose}. */
  readonly type: TextureResourceType;

  #refCount = 0;

  /**
   * How many `TextureStore#on()` subscriptions hold this resource, a pending
   * `TextureStore#getAsync()` among them, and every lease of `TextureStore#acquireAsync()` that is
   * not released yet. `TextureStore#clearUnused()` and `TextureStore#parse()` with
   * `{evictMissing: true}` dispose a resource only while this is 0.
   *
   * Read-only: the store that holds the resource keeps the count.
   *
   * Goes on counting once {@link TextureResource.dispose} has run, until the last subscription that
   * holds the resource lets go.
   */
  get refCount(): number {
    return this.#refCount;
  }

  /** @internal */
  [changeRefCount](delta: 1 | -1): void {
    this.#refCount += delta;
  }

  // Every getter of a resource answers `undefined` once dispose() has run, `refCount` aside:
  // that one goes on counting the subscriptions that still hold the resource. A setter needs
  // no guard against a write that arrives too late: once dispose() has returned,
  // SignalGroup.delete(this) has taken the change bridges and the effects down, so nothing
  // reads what such a write would still put into a signal. The setters of the inputs of one
  // shape check the flag all the same, and so do the accessors that refuse the inputs of
  // another shape — those throw, and a disposed resource has to stay silent.

  /**
   * The url of the image the texture is built from: an input of an image and a tile set resource,
   * and on an atlas resource the image its json names — the `overrideImageUrl` while one is set.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run.
   */
  get imageUrl(): string | undefined {
    return this.#disposed ? undefined : this.#imageUrl.value;
  }

  /**
   * The coordinates of the whole image, or `undefined` while no image is loaded.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run.
   */
  get imageCoords(): TextureCoords | undefined {
    return this.#disposed ? undefined : this.#imageCoords.value;
  }

  /**
   * The atlas of an atlas resource, or of the tile set of a tile set resource; `undefined` while
   * there is none.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run.
   */
  get atlas(): TextureAtlas | undefined {
    return this.#disposed ? undefined : this.#atlas.value;
  }

  /**
   * The tile set of a tile set resource, or `undefined` while there is none.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run.
   */
  get tileSet(): TileSet | undefined {
    return this.#disposed ? undefined : this.#tileSet.value;
  }

  /**
   * The animations of a tile set or an atlas resource, or `undefined` while there are none.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run.
   */
  get frameBasedAnimations(): FrameBasedAnimations | undefined {
    return this.#disposed ? undefined : this.#frameBasedAnimations.value;
  }

  /**
   * The texture classes the texture is built with; an empty list is stored as `undefined`.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get textureClasses(): TextureOptionClasses[] | undefined {
    return this.#disposed ? undefined : this.#textureClasses.value;
  }

  set textureClasses(value: TextureOptionClasses[] | undefined) {
    if (Array.isArray(value) && value.length === 0) {
      value = undefined;
    }
    this.#textureClasses.set(value);
  }

  /**
   * The factory that builds the texture; a `TextureStore` writes its shared one.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get textureFactory(): TextureFactory | undefined {
    return this.#disposed ? undefined : this.#textureFactory.value;
  }

  set textureFactory(value: TextureFactory | undefined) {
    this.#textureFactory.set(value);
  }

  /**
   * The texture this resource built from its image, or `undefined` while there is none.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run.
   */
  get texture(): Texture | undefined {
    return this.#disposed ? undefined : this.#texture.value;
  }

  /**
   * How this resource fetches its image. The store it belongs to injects its shared,
   * de-duplicating cache here; a resource on its own falls back to a plain `ImageLoader`.
   *
   * Every run of the image effect takes one lease and gives it back in its cleanup, which
   * is what lets the store drop a cached image once no resource wants it any more.
   *
   * @internal
   */
  [imageSource]?: TextureImageSource;

  /**
   * The renderer a resource on its own builds its textures with. While no `textureFactory` was
   * written from outside — a `TextureStore` writes its shared one — the resource builds a
   * `TextureFactory` for it that starts from no texture class, as the factory of a store does,
   * and a new one whenever another renderer is written; the texture follows the new factory.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get renderer(): WebGPURenderer | undefined {
    return this.#disposed ? undefined : this.#renderer.value;
  }

  set renderer(value: WebGPURenderer | undefined) {
    this.#renderer.set(value);
  }

  // the texture that is currently published on the signal, and therefore the one this
  // resource owns: every texture that reaches the signal was built here, and is released
  // here once its successor has taken its place
  #ownTexture?: Texture;
  // the image url `#ownTexture` was built from: a run without a factory takes back a texture of
  // another image than the one it loaded
  #ownTextureUrl?: string;

  // the failure each step last ended with, until that step runs again: a resource does not
  // try again by itself, and a getAsync() that comes after the failure has to see it all the
  // same. Only a step that ends without its result lands here — a subscriber that throws while
  // a result is published is no failure of the step: the result is there
  #loadFailures = new Map<LoadStep, TextureResourceLoadFailure>();

  #activated = false;
  #disposed = false;

  /**
   * A resource of the given `type`, the shape the class that calls it stands for: an
   * {@link ImageTextureResource}, a {@link TileSetTextureResource} or an
   * {@link AtlasTextureResource}.
   *
   * @throws {TypeError} when it is called for the base itself, which only JavaScript can do
   */
  protected constructor(id: string, type: TextureResourceType) {
    if (new.target === TextureResource) {
      // the fields above have created their signals by now; they go with the instance that is refused
      SignalGroup.delete(this);
      throw new TypeError(
        'new TextureResource(): TextureResource is the base of the three shapes of resource — build an ImageTextureResource, ' +
          'a TileSetTextureResource or an AtlasTextureResource, or call TextureResource.fromImage(), fromTileSet() or fromAtlas()',
      );
    }

    eventize(this);

    this.id = id;
    this.type = type;

    this.#context = {
      imageUrl: this.#imageUrl,
      imageCoords: this.#imageCoords,
      imageUrlOfCoords: this.#imageUrlOfCoords,
      atlas: this.#atlas,
      tileSet: this.#tileSet,
      frameBasedAnimations: this.#frameBasedAnimations,
      adapterAnimations: this.#adapterAnimations,
      frameBasedAnimationsData: this.#frameBasedAnimationsData,
      isDisposed: () => this.#disposed,
      clearFailure: (step) => {
        this.#loadFailures.delete(step);
      },
      fail: (step, failure) => this.#fail(step, failure),
      registerAnimationsEffect: (source, addEntry, baseAnimations) =>
        this.#registerAnimationsEffect(source, addEntry, baseAnimations),
    };

    retain(this, ['imageCoords', 'atlas', 'tileSet', 'texture', 'frameBasedAnimations']);
  }

  /**
   * Release this resource.
   *
   * Disposes the texture of this resource — it was built here, so it is released here.
   * The atlas, the tile set and the texture factory are left alone.
   *
   * Afterwards every getter of this resource answers `undefined`, while
   * {@link TextureResource.id} and {@link TextureResource.type} still say which resource
   * this was and {@link TextureResource.refCount} how many subscriptions still hold it. A
   * write to any setter, an {@link TextureResource.activate} and a second `dispose()` do
   * nothing — a setter that would throw on the shape of this resource stays silent as well.
   *
   * A listener of the `dispose` event of this resource or of its texture that throws does not
   * hold up the teardown: the resource is torn down whole, and the throw goes on to the caller
   * afterwards — both together as an `AggregateError`, the one of the resource first. A second
   * `dispose()` does nothing and throws nothing.
   *
   * A resource of a `TextureStore` that is disposed directly leaves its store: the next `parse()`
   * that names its id builds a new one, `TextureStore#on()` follows that one, and a
   * `TextureStore#getAsync()` that waits on this one rejects.
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;

    // a listener that throws does not hold up the teardown: its error waits until the resource
    // is down, so a caller that catches it holds a disposed resource, not half of one
    const errors: unknown[] = [];

    try {
      // every listener hears it, even behind one that throws
      emitStrict(this, OnDispose);
    } catch (error) {
      errors.push(error);
    }

    // the dispose event above is how subscribers learn this resource is gone; muting
    // keeps the clean-up below from following it with a texture update that would hand
    // a subscriber an undefined where the event type promises a Texture
    this.#texture.muted = true;
    this.#texture.set(undefined);

    // released only after the signal has given it up, so no reader can ever reach a
    // texture that is already freed. three dispatches the dispose event of the texture in
    // here, and a listener of that event may throw as well
    try {
      this.#ownTexture?.dispose();
    } catch (error) {
      errors.push(error);
    }
    this.#ownTexture = undefined;
    this.#ownTextureUrl = undefined;

    this.#loadFailures.clear();

    SignalGroup.delete(this);
    off(this);

    throwCollected(
      errors,
      `TextureResource#dispose(): listeners of the dispose events of resource "${this.id}" and of its texture threw`,
    );
  }

  // the record goes in before the event goes out: a listener of the error event reads it
  #fail(step: LoadStep, failure: TextureResourceLoadFailure): void {
    this.#loadFailures.set(step, failure);
    emitSafe(this, OnError, failure);
  }

  /** @internal */
  [loadFailureFor](subTypes: readonly TextureResourceSubType[]): TextureResourceLoadFailure | undefined {
    if (this.#disposed) return undefined;
    for (const [step, failure] of this.#loadFailures) {
      if (SUBTYPES_HELD_BACK_BY_STEP[step].some((subType) => subTypes.includes(subType))) return failure;
    }
    return undefined;
  }

  /**
   * The subtypes of `subTypes` this resource never builds: by its type, and with `'now'` also
   * `frameBasedAnimations` while the data it carries now builds none — a tile set without
   * `frameBasedAnimationsData`, and an atlas without it once its atlas stands and its atlas adapter
   * read no animations out of the json; before the atlas is there, it is open whether the adapter
   * reads any. Answers `[]` once the resource is disposed.
   *
   * @internal
   */
  [subTypesOutOfReach](subTypes: readonly TextureResourceSubType[], scope: 'type' | 'now'): TextureResourceSubType[] {
    if (this.#disposed) return [];
    const built = SUBTYPES_BUILT_BY_TYPE[this.type];
    const outOfReach = subTypes.filter((subType) => !built.includes(subType));
    if (scope === 'now' && subTypes.includes('frameBasedAnimations') && built.includes('frameBasedAnimations')) {
      const noData = this.#frameBasedAnimationsData.value == null;
      const noAnimations =
        this.type === 'tileset'
          ? noData
          : noData && this.#atlas.value !== undefined && this.#adapterAnimations.value === undefined;
      if (noAnimations) outOfReach.push('frameBasedAnimations');
    }
    return outOfReach;
  }

  /**
   * Register the effects that turn the data of this resource into an atlas, a tile set
   * and a texture, and return `this`. Calling it more than once registers them once.
   *
   * Which effects are registered follows the class of the resource, whatever values it holds at
   * the call: a `tileSetOptions` or an `atlasUrl` that is empty now and set later still reaches
   * them. What the resource holds at the call is taken up as if it were written right after it:
   * an `atlasJson` written before builds its atlas once the image it names is there, and the
   * `atlasUrl` is fetched unless an `atlasJson` was written after it.
   *
   * It fetches nothing by itself: the effects do that, once the resource has what they
   * read. `TextureStore#loadAsync()` fetches a catalog and builds its resources.
   *
   * On a disposed resource this does nothing — no effect and no signal is created — and
   * returns `this`.
   */
  activate(): this {
    if (this.#disposed || this.#activated) return this;
    this.#activated = true;

    // A value that is taken back is not announced: a subscriber would get an `undefined`
    // where the event promises a value. The retained event is cleared instead, so a
    // subscriber that arrives later waits for the next value rather than being handed
    // the one that was taken back.
    const publish = <T>(signal: Signal<T | undefined>, event: TextureResourceSubType) => {
      signal.onChange((value) => {
        if (value === undefined) {
          retainClear(this, event);
        } else {
          // every subscriber hears the value and the retained event takes it, even behind
          // one that throws; the throw goes on to the writer afterwards
          emitStrict(this, event, value);
        }
      });
    };

    // these bridges end with the signals they read: the signals are attached to this
    // resource, and SignalGroup.delete(this) in dispose() destroys them
    publish(this.#imageCoords, 'imageCoords');
    publish(this.#atlas, 'atlas');
    publish(this.#tileSet, 'tileSet');
    publish(this.#frameBasedAnimations, 'frameBasedAnimations');
    publish(this.#texture, 'texture');

    this.#registerImageEffect();

    // the class decides which effects run, not the values the resource holds at this call: the
    // inputs of its shape are there from the constructor on, and a value that arrives later
    // reaches the effects that read it
    this.registerShapeEffects();

    // Standalone fallback: a resource on its own — its renderer written directly, with no
    // `TextureStore` around — builds a factory that starts from no texture class, as the factory
    // of a store does. A new renderer brings a new factory, which asks that renderer for its
    // anisotropy maximum at every texture it builds; a factory written from outside, the shared
    // one of a store among them, stays.

    // the factory this fallback built and the renderer it built it for
    let fallback: {renderer: WebGPURenderer; factory: TextureFactory} | undefined;
    createEffect(
      () => {
        const renderer = this.#renderer.get();
        if (!renderer || renderer === fallback?.renderer) return;
        const factory = this.#textureFactory.value;
        if (factory && factory !== fallback?.factory) return;
        fallback = {renderer, factory: new TextureFactory(renderer, [])};
        this.textureFactory = fallback.factory;
      },
      {attach: this},
    );

    return this;
  }

  /**
   * @deprecated Use {@link TextureResource.activate}: it registers the effects of this resource
   *   and loads nothing by itself. The old name stays as an alias until a breaking release
   *   removes it.
   */
  load(): this {
    return this.activate();
  }

  /**
   * Register the effects of the shape of this resource. {@link TextureResource.activate} calls it
   * once, after the image effect and before the fallback of the texture factory.
   *
   * @internal
   */
  protected abstract registerShapeEffects(): void;

  #registerImageEffect(): void {
    // The image a resource on its own fetched last, handed out again to a run that asks for the same
    // url: a run without a factory loads the image, and the run the arriving factory starts asks for
    // it once more. A load that failed is dropped, so the next run tries again, and so is the image
    // once the url is cleared: nothing is built from it any more. A resource of a store fetches
    // through the image cache of the store instead, which shares one image for the same reason
    let standalone: {url: string; image: Promise<HTMLImageElement>} | undefined;
    const loadStandalone = (url: string): Promise<HTMLImageElement> => {
      if (standalone?.url === url) return standalone.image;
      const entry = {url, image: new ImageLoader().loadAsync(url)};
      entry.image.catch(() => {
        if (standalone === entry) standalone = undefined;
      });
      standalone = entry;
      return entry.image;
    };

    // auto-tracking effect (no static deps) so it autoruns at registration
    // — activate() is typically called AFTER `textureFactory` and `imageUrl` are
    // already set on the resource (by the store's parse-time injection), and
    // a static-dep effect would otherwise never fire because no dep changes
    // post-registration.
    createEffect(
      () => {
        // a new run is a new attempt at the image step
        this.#loadFailures.delete('image');
        const factory = this.#textureFactory.get();
        const url = this.#imageUrl.get();
        const classes = this.#textureClasses.get();
        // no url, no image: what was built from the last one is taken back. Without a factory the
        // image is loaded all the same and everything but the texture is published — the
        // coordinates, and what the other effects build from them; the texture of the last factory
        // stays for as long as it was built from this very image
        if (!url) {
          standalone = undefined;
          this.#takeBackImage();
          return;
        }

        let aborted = false;

        // one lease per run, given back by the cleanup of exactly this run: a source that is
        // swapped in between cannot make this run give back what it never took
        const lease: ImageLease | undefined = this[imageSource]?.acquire(url);

        // No closing .catch(): the `error` events go out with emitSafe() and throw nothing, so
        // what either handler still throws is a dispose listener of the texture this run
        // replaces. It throws out of the `finally` of #publishImageWithTexture() or
        // #publishImageWithoutTexture() before a throw that the batch handed back has gone out as
        // an `error` event, takes its place, is no failure of this step and ends as an unhandled
        // rejection
        (lease?.image ?? loadStandalone(url)).then(
          (image) => {
            if (aborted) return;
            if (factory) this.#publishImageWithTexture(url, image, factory, classes);
            else this.#publishImageWithoutTexture(url, image);
          },
          (error) => {
            // the second parameter of .then() sees exactly the rejection of the image load
            // this promise wraps — the one case an `{source: 'image', url}` describes
            if (aborted) return;
            this.#fail('image', {source: 'image', url, error});
          },
        );

        return () => {
          // a texture that reached the signal outlives this run and is released by the run
          // that replaces it, or by dispose() — freeing it here would leave the signal
          // pointing at a texture that is already gone
          aborted = true;
          lease?.release();
        };
      },
      {attach: this},
    );
  }

  // What a run with a factory publishes of the image it loaded: the coordinates, the texture it
  // builds of the image with the texture classes of the run, and with them whatever the other
  // effects build out of them — in one batch. The texture this one takes the place of is released
  // after the batch. A failure to build either value is a failure of the image step
  #publishImageWithTexture(
    url: string,
    image: HTMLImageElement,
    factory: TextureFactory,
    classes: TextureOptionClasses[] | undefined,
  ): void {
    // the coordinates first, so a throw there leaves no texture behind that nobody
    // releases. There is no failed url to name here, so the resource is reported
    let coords: TextureCoords;
    let texture: Texture;
    try {
      coords = new TextureCoords(0, 0, image.width, image.height);
      texture = factory.create(image, ...(classes ?? []));
    } catch (error) {
      this.#fail('image', {source: 'texture', id: this.id, error});
      return;
    }
    texture.name = this.id;
    // The resource owns the texture before it publishes it: a subscriber that throws
    // inside the batch, or one that disposes this resource, cannot skip the handover —
    // dispose() releases whatever is owned at that moment. The predecessor stays alive
    // while it is still the published value and is released only after the batch, once
    // the successor is on the signal and no reader can reach it
    const previous = this.#ownTexture;
    this.#ownTexture = texture;
    this.#ownTextureUrl = url;
    let publishError: {error: unknown} | undefined;
    try {
      // one batch: the three values reach their effects together, and the higher
      // priority of everything derived from the image — the atlas among it — puts
      // those runs ahead of the bridge that carries the texture out
      batch(() => {
        this.#imageUrlOfCoords.set(url);
        this.#imageCoords.set(coords);
        this.#texture.set(texture);
      });
    } catch (error) {
      // a subscriber that throws inside the batch lands here: signalize propagates
      // inline, isolates the throw and rethrows it to the writer once delivery ends,
      // several at once as an AggregateError, and the writer is the batch() itself.
      // Every value is published by then and every subscriber has heard it, so the step
      // has its result: the throw is reported without a record that would hold a value
      // back, and whether this run was cut short in the meantime changes nothing
      publishError = {error};
    } finally {
      previous?.dispose();
    }
    if (publishError) {
      emitSafe(this, OnError, {source: 'texture', id: this.id, error: publishError.error});
    }
  }

  // What a run without a factory publishes of the image it loaded: the coordinates, and with them
  // whatever the other effects build out of them. A texture built from another image describes
  // something that is no longer there and is taken back, in the same batch and released after it,
  // as #takeBackImage() does; one built from this very image stays — a factory that is cleared, or
  // texture classes that change without one, take nothing away
  #publishImageWithoutTexture(url: string, image: HTMLImageElement): void {
    let coords: TextureCoords;
    try {
      coords = new TextureCoords(0, 0, image.width, image.height);
    } catch (error) {
      this.#fail('image', {source: 'texture', id: this.id, error});
      return;
    }
    const stale = this.#ownTextureUrl === url ? undefined : this.#ownTexture;
    if (stale) {
      this.#ownTexture = undefined;
      this.#ownTextureUrl = undefined;
    }
    let publishError: {error: unknown} | undefined;
    try {
      batch(() => {
        this.#imageUrlOfCoords.set(url);
        this.#imageCoords.set(coords);
        if (stale) this.#texture.set(undefined);
      });
    } catch (error) {
      // a subscriber that throws inside the batch: every value is published by then, as in the run
      // with a factory, so the throw is reported without a record that would hold a value back
      publishError = {error};
    } finally {
      stale?.dispose();
    }
    if (publishError) {
      emitSafe(this, OnError, {source: 'texture', id: this.id, error: publishError.error});
    }
  }

  // A cleared image takes back what was built from it: the coordinates and the texture here, and
  // with the coordinates the tile set, its atlas and the animations, in the effects that hang off
  // them. The texture was built here and is released here, once the signal has given it up, so no
  // reader reaches a texture that is already freed. Nothing is announced: the bridges clear the
  // retained events instead of handing a subscriber `undefined`
  #takeBackImage(): void {
    const previous = this.#ownTexture;
    this.#ownTexture = undefined;
    this.#ownTextureUrl = undefined;
    try {
      batch(() => {
        this.#imageUrlOfCoords.set(undefined);
        this.#imageCoords.set(undefined);
        this.#texture.set(undefined);
      });
    } finally {
      previous?.dispose();
    }
  }

  // The animations of the current data, built out of the current tile set or atlas. `addEntry`
  // registers one entry or throws for it: an entry it throws for is skipped and reported, and every
  // other entry of the map is registered all the same. The entries go into a copy of the animations
  // the atlas adapter read out of the json, where there are some
  #registerAnimationsEffect<S extends TileSet | TextureAtlas>(
    source: Signal<S | undefined>,
    addEntry: (animations: FrameBasedAnimations, name: string, data: FrameBasedAnimationsData, source: S) => void,
    baseAnimations?: Signal<FrameBasedAnimations | undefined>,
  ): void {
    createEffect(
      () => {
        const from = source.value;
        const animationsData = this.#frameBasedAnimationsData.value;
        const base = baseAnimations?.value;
        // animations come only out of the current source and the current data or the animations
        // of the adapter; without either of them they are taken back, which clears the retained event
        if (!from || (!animationsData && !base)) {
          this.#frameBasedAnimations.set(undefined);
          return;
        }
        // published as one finished object: a subscriber that reads it in the change
        // callback would otherwise see an animation set that is still filling up. A copy of the
        // animations of the adapter, so that a change of the data never adds to them twice
        const animations = base ? base.clone() : new FrameBasedAnimations();
        for (const [name, data] of Object.entries(animationsData ?? {})) {
          try {
            addEntry(animations, name, data, from);
          } catch (error) {
            // One bad entry skips itself. Without this the throw leaves the effect through the
            // global error channel of signalize, no animation of the whole map is registered,
            // and the caller is told nothing. emitSafe() for the same reason: an error listener
            // that throws would take the rest of the map with it.
            emitSafe(this, OnError, {source: 'frameBasedAnimations', id: this.id, animation: name, error});
          }
        }
        this.#frameBasedAnimations.set(animations);
      },
      baseAnimations ? [source, this.#frameBasedAnimationsData, baseAnimations] : [source, this.#frameBasedAnimationsData],
      {attach: this},
    );
  }
}

/**
 * An image turned into a texture: `imageUrl` names the file to load. It builds `imageCoords` and a
 * `texture` alone — its `atlas`, `tileSet` and `frameBasedAnimations` stay `undefined`.
 *
 * It has no input of another shape: TypeScript refuses a write to one, and in JavaScript the write
 * throws a `TypeError`, while reading one answers `undefined`.
 */
export class ImageTextureResource extends TextureResource {
  declare readonly type: 'image';

  readonly #context = shapeContextOf(this);

  constructor(id: string) {
    super(id, 'image');
  }

  /**
   * The url of the image to load. A cleared url takes the `imageCoords` and the `texture` back and
   * releases the texture.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  override get imageUrl(): string | undefined {
    return super.imageUrl;
  }

  override set imageUrl(url: string | undefined) {
    if (this.#context.isDisposed()) return;
    this.#context.imageUrl.set(url);
  }

  override get atlas(): undefined {
    return undefined;
  }

  override get tileSet(): undefined {
    return undefined;
  }

  override get frameBasedAnimations(): undefined {
    return undefined;
  }

  /** @internal */
  protected override registerShapeEffects(): void {
    // the image effect of the base is all an image needs
  }
}

/**
 * An image cut into tiles: `imageUrl` names the file to load, `tileSetOptions` how to cut it, and
 * `frameBasedAnimationsData` the animations over its tiles. It builds `imageCoords`, a `texture`, a
 * `tileSet`, the `atlas` of that tile set and `frameBasedAnimations`.
 *
 * It has no input of another shape: TypeScript refuses a write to one, and in JavaScript the write
 * throws a `TypeError`, while reading one answers `undefined`.
 */
export class TileSetTextureResource extends TextureResource {
  declare readonly type: 'tileset';

  readonly #context = shapeContextOf(this);

  readonly #tileSetOptions = createSignal<Readonly<TileSetOptions> | undefined>(undefined, {compare: cmpShallow, attach: this});

  constructor(id: string) {
    super(id, 'tileset');
  }

  /**
   * The url of the image to load. A cleared url takes the `imageCoords` and the `texture` back,
   * together with the `tileSet`, its `atlas` and the `frameBasedAnimations`, and releases the
   * texture.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  override get imageUrl(): string | undefined {
    return super.imageUrl;
  }

  override set imageUrl(url: string | undefined) {
    if (this.#context.isDisposed()) return;
    this.#context.imageUrl.set(url);
  }

  /**
   * The options of the tile set. What is stored is a frozen copy: a change to the object after the
   * write reaches the tile set only once it is written again, and writing it again after a change
   * builds a new tile set.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get tileSetOptions(): Readonly<TileSetOptions> | undefined {
    return this.#context.isDisposed() ? undefined : this.#tileSetOptions.value;
  }

  set tileSetOptions(value: TileSetOptions | undefined) {
    if (this.#context.isDisposed()) return;
    this.#tileSetOptions.set(value == null ? undefined : Object.freeze({...value}));
  }

  /**
   * The animations over the tiles of the tile set, by name: each entry names its tiles by `tileIds`
   * or by `firstTileId` and `tileCount`.
   *
   * - It is compared by content: data equal to the current — the same catalog parsed again, for
   *   one — keeps the animations, and no event goes out.
   * - The object is kept as it was written: a change to it after the write reaches the resource
   *   only with data that differs from it.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get frameBasedAnimationsData(): FrameBasedAnimationsDataMap | undefined {
    return this.#context.isDisposed() ? undefined : this.#context.frameBasedAnimationsData.value;
  }

  set frameBasedAnimationsData(value: FrameBasedAnimationsDataMap | undefined) {
    if (this.#context.isDisposed()) return;
    this.#context.frameBasedAnimationsData.set(value);
  }

  /** @internal */
  protected override registerShapeEffects(): void {
    const context = this.#context;
    const tileSetOptions = this.#tileSetOptions;

    createEffect(
      () => {
        context.clearFailure('tileSet');
        const imageCoords = this.imageCoords;
        const options = tileSetOptions.value;

        let tileSet: TileSet | undefined;
        let refusal: {error: unknown} | undefined;
        if (imageCoords && options) {
          try {
            tileSet = new TileSet(imageCoords, options);
          } catch (error) {
            refusal = {error};
          }
        }

        if (tileSet) {
          // one batch: a subscriber of the tile set that throws makes its set() throw, and
          // the atlas of that tile set would never reach the resource
          const built = tileSet;
          batch(() => {
            context.tileSet.set(built);
            context.atlas.set(built.atlas);
          });
          return;
        }

        // Nothing on the resource may have been built from an image or from options other than
        // the current ones, so without a tile set from both of them the tile set, its atlas and
        // the animations built on it are taken back — the animations here as well, because
        // inside a batch the animation effect runs after this one and an error listener
        // reading the resource would still find them. A refusal is reported here instead of
        // thrown: thrown, it would reach whoever wrote the options — a setter, a
        // `TextureStore#parse()` cut short before its ready event — or the image effect,
        // whose load would then end as a texture failure.
        context.tileSet.set(undefined);
        context.atlas.set(undefined);
        context.frameBasedAnimations.set(undefined);

        if (refusal) {
          context.fail('tileSet', {source: 'texture', id: this.id, error: refusal.error});
        }
      },
      [context.imageCoords, tileSetOptions],
      {attach: this, priority: DERIVED_FROM_IMAGE_PRIORITY},
    );

    context.registerAnimationsEffect(context.tileSet, (animations, name, data, tileSet) => {
      const shape = animationDataShape(data);
      if (shape !== 'tileIds' && shape !== 'firstTileId') throw wrongAnimationDataError(this, name, shape);
      // the entry goes in as the timing: add() reads its duration or frameRate, and it is the one
      // place that refuses an entry carrying neither, with the name of the animation
      if ('tileIds' in data) {
        // add() would read a number here as a `firstTileId` and quietly build an animation
        // over the whole tile set
        const {tileIds} = data as {tileIds: unknown};
        if (!Array.isArray(tileIds)) {
          throw new Error(
            `TextureResource: animation "${name}" of resource "${this.id}" carries tileIds of ${describeValue(tileIds)} ` +
              `— tileIds is an array of tile ids`,
          );
        }
        animations.add(name, data, tileSet, data.tileIds);
      } else if ('firstTileId' in data) {
        animations.add(name, data, tileSet, data.firstTileId, data.tileCount);
      }
    });
  }
}

/**
 * A texture atlas json and the image it names. It builds `imageCoords`, a `texture`, an `atlas` and
 * `frameBasedAnimations`, but never a `tileSet`.
 *
 * - `atlasUrl` names the json to fetch; the resource writes what it fetched to `atlasJson`.
 * - `atlasJson` is input and output both: the json fetched from `atlasUrl`, or one written from
 *   outside.
 * - `overrideImageUrl` names another image than the one the json names.
 * - `atlasAdapter` reads the json into the atlas and its animations.
 * - `frameBasedAnimationsData` names the animations over the frames of the atlas.
 *
 * `imageUrl` is an output here: the resource takes it from `overrideImageUrl ?? atlasJson.meta.image`.
 * TypeScript refuses a write to it, and in JavaScript the write throws a `TypeError` —
 * `overrideImageUrl` is the way to send the resource to another image, and it keeps the atlas and
 * the texture together.
 *
 * It has no input of another shape: TypeScript refuses a write to one, and in JavaScript the write
 * throws a `TypeError`, while reading one answers `undefined`.
 */
export class AtlasTextureResource extends TextureResource {
  declare readonly type: 'atlas';

  readonly #context = shapeContextOf(this);

  readonly #atlasAdapter = createSignal<AtlasAdapter | undefined>(undefined, {attach: this});
  readonly #atlasUrl = createSignal<string | undefined>(undefined, {attach: this});
  readonly #atlasJson = createSignal<TexturePackerJsonData | undefined>(undefined, {attach: this});
  // the json as `atlasUrl` delivered it, with a relative `meta.image` resolved against that url,
  // but without the `overrideImageUrl` put in its place
  readonly #fetchedAtlasJson = createSignal<FetchedAtlasJson | undefined>(undefined, {attach: this});
  readonly #overrideImageUrl = createSignal<string | undefined>(undefined, {attach: this});

  // the atlas fetch under way, if there is one: the run of the fetch effect that started it
  // sets it and lets go of it when the fetch is over; that run's cleanup and the `atlasJson`
  // setter cut it short
  #atlasFetch?: AbortController;

  // whether activate() starts the fetch of `atlasUrl`: a url that changes makes it due, and an
  // `atlasJson` written after it takes its place, as it cuts short a fetch under way. Read by
  // activate() alone — once the effects are registered, a new url starts its fetch by itself
  #atlasFetchDue = false;

  constructor(id: string) {
    super(id, 'atlas');
  }

  override get tileSet(): undefined {
    return undefined;
  }

  /**
   * The url of the atlas json. A change fetches the json at the new url.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get atlasUrl(): string | undefined {
    return this.#context.isDisposed() ? undefined : this.#atlasUrl.value;
  }

  set atlasUrl(value: string | undefined) {
    if (this.#context.isDisposed()) return;
    if (value !== this.#atlasUrl.value) this.#atlasFetchDue = true;
    this.#atlasUrl.set(value);
  }

  /**
   * The atlas json of the resource.
   *
   * - For a json fetched from `atlasUrl`, `meta.image` names the image the texture is built from:
   *   the `overrideImageUrl` while one is set, the image the json names otherwise — a relative
   *   name resolved against `atlasUrl`, so it names the file next to the json. The
   *   `overrideImageUrl` is taken as written.
   * - A json written from outside replaces the fetched one and a fetch of `atlasUrl` that failed,
   *   and it cuts short a fetch that is still under way: neither the json nor a failure of that
   *   fetch arrives after the write. It has no url of its own and keeps its `meta.image` as
   *   written, and the image loader resolves a relative one against the document.
   * - Written before {@link TextureResource.activate}, it takes the place of the fetch of the
   *   `atlasUrl` it was written after.
   * - While it is cleared, the resource offers no `atlas` and no `frameBasedAnimations`.
   * - A json that its atlas adapter cannot read — or an adapter that answers no `TextureAtlas`, or
   *   animations that are no `FrameBasedAnimations` — takes both back as well and is reported as an
   *   `error` with `source: 'texture'` once the image it names is there; writing it does not throw.
   * - The animations an adapter reads out of the json — the frame tags of an Aseprite json — are the
   *   `frameBasedAnimations` of the resource, and the entries of `frameBasedAnimationsData` are added
   *   to a copy of them; an entry named like one of them is skipped and reported.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get atlasJson(): TexturePackerJsonData | undefined {
    return this.#context.isDisposed() ? undefined : this.#atlasJson.value;
  }

  set atlasJson(value: TexturePackerJsonData | undefined) {
    if (this.#context.isDisposed()) return;
    // a fetch of `atlasUrl` that is still under way, and a fetch that activate() has yet to
    // start, would replace this json once it arrives — through `#fetchedAtlasJson` and the atlas
    // image effect — and its failure would hold back what this json brings
    this.#atlasFetch?.abort();
    this.#atlasFetch = undefined;
    this.#atlasFetchDue = false;
    // a json written from outside replaces the fetched one: a later change of the
    // `overrideImageUrl` must not bring the fetched json back in its place
    this.#fetchedAtlasJson.set(undefined);
    // and a fetch that failed holds nothing back any more; its effect hangs off `atlasUrl`
    // alone and would not run again to clear the record
    this.#context.clearFailure('atlasFetch');
    this.#atlasJson.set(value);
  }

  /**
   * The url of the image to build the texture from instead of the one the atlas json names.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get overrideImageUrl(): string | undefined {
    return this.#context.isDisposed() ? undefined : this.#overrideImageUrl.value;
  }

  set overrideImageUrl(value: string | undefined) {
    if (this.#context.isDisposed()) return;
    this.#overrideImageUrl.set(value);
  }

  /**
   * The adapter that reads the `atlasJson` into the `atlas` and, if the json names any, its
   * animations — `undefined` to pick one by `meta.app` of the json: among the adapters of the
   * `TextureStore` the resource belongs to, among `texturePackerAtlasAdapter` and
   * `asepriteAtlasAdapter` for a resource on its own. A change reads the json again.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get atlasAdapter(): AtlasAdapter | undefined {
    return this.#context.isDisposed() ? undefined : this.#atlasAdapter.value;
  }

  set atlasAdapter(value: AtlasAdapter | undefined) {
    if (this.#context.isDisposed()) return;
    this.#atlasAdapter.set(value);
  }

  /**
   * The animations over the frames of the atlas, by name: each entry names its frames by
   * `frameNameQuery`. They are added to a copy of the animations the atlas adapter reads out of the
   * json.
   *
   * - It is compared by content: data equal to the current — the same catalog parsed again, for
   *   one — keeps the animations, and no event goes out. A `RegExp` equals one of the same `source`
   *   and `flags`.
   * - The object is kept as it was written: a change to it after the write reaches the resource
   *   only with data that differs from it.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run; a write afterwards does nothing.
   */
  get frameBasedAnimationsData(): FrameBasedAnimationsDataMap | undefined {
    return this.#context.isDisposed() ? undefined : this.#context.frameBasedAnimationsData.value;
  }

  set frameBasedAnimationsData(value: FrameBasedAnimationsDataMap | undefined) {
    if (this.#context.isDisposed()) return;
    this.#context.frameBasedAnimationsData.set(value);
  }

  /**
   * How this resource picks an atlas adapter for a json by its `meta.app` while no `atlasAdapter`
   * is written. The store it belongs to injects the pick among its registered adapters; a resource
   * on its own picks among the built-in ones.
   *
   * @internal
   */
  [atlasAdapterPicker]?: (json: TexturePackerJsonData) => AtlasAdapter;

  /** @internal */
  protected override registerShapeEffects(): void {
    const context = this.#context;
    const atlasUrlSignal = this.#atlasUrl;
    const atlasJsonSignal = this.#atlasJson;
    const fetchedAtlasJsonSignal = this.#fetchedAtlasJson;
    const overrideImageUrlSignal = this.#overrideImageUrl;
    const atlasAdapterSignal = this.#atlasAdapter;

    createEffect(
      () => {
        context.clearFailure('atlasFetch');
        const atlasUrl = this.atlasUrl;
        if (!atlasUrl) return;
        const ac = new AbortController();
        this.#atlasFetch = ac;
        // No closing .catch() here either: fetchAtlasJson() never rejects, and after it nothing
        // throws any more — the fail() of a fetch without a result and the `error` of a throw while
        // publishing both go out with emitSafe()
        void (async () => {
          // the fetch alone: writing the json publishes whatever it brings — with its image already
          // there, the atlas within this very call — and a subscriber that throws there is no
          // failure of the fetch
          let result: AtlasJsonFetch | undefined;
          try {
            result = await fetchAtlasJson(atlasUrl, ac.signal);
          } finally {
            if (this.#atlasFetch === ac) this.#atlasFetch = undefined;
          }
          // cut short: by the cleanup of this run, by an `atlasJson` written meanwhile, or by dispose()
          if (!result) return;
          if ('failure' in result) {
            context.fail('atlasFetch', result.failure);
            return;
          }
          try {
            fetchedAtlasJsonSignal.set({json: result.json, url: atlasUrl});
          } catch (error) {
            // signalize hands the throw of a subscriber to the writer once every effect has
            // run: the json and what is built from it are published, so no record is kept
            emitSafe(this, OnError, {source: 'texture', id: this.id, error});
          }
        })();
        return () => {
          ac.abort();
          if (this.#atlasFetch === ac) this.#atlasFetch = undefined;
        };
      },
      [atlasUrlSignal],
      {attach: this},
    );

    createEffect(
      () => {
        context.clearFailure('atlasImage');
        const fetched = fetchedAtlasJsonSignal.value;
        if (!fetched) return;
        const {json, url} = fetched;
        const imageUrl = this.overrideImageUrl ?? json.meta.image;
        if (typeof imageUrl !== 'string') {
          // the json that is published stays as it was: a subscriber would get an `undefined`
          // where the event type promises a value
          context.fail('atlasImage', {
            source: 'atlas',
            url,
            error: new Error(`TextureResource: the response of "${url}" names no image and no overrideImageUrl was given`),
          });
          return;
        }
        // the resolved url goes into the published json, mirroring `TextureAtlasLoader`: `atlasJson`
        // is typed as `TexturePackerJsonData`, whose `meta.image` is a `string`, so the resolved url
        // has to land in the json itself rather than in a cast that would let the getter lie. The
        // fetched json, without the override, stays in `#fetchedAtlasJson`, so an override that is
        // cleared again gives the image back to the one the json names. Written straight onto the
        // signal, because the public setter treats a write as a json from outside and drops the
        // fetched one
        atlasJsonSignal.set({...json, meta: {...json.meta, image: imageUrl}});
      },
      [fetchedAtlasJsonSignal, overrideImageUrlSignal],
      {attach: this},
    );

    createEffect(
      () => {
        if (this.atlasJson) {
          // straight onto the signal: on this shape of resource `imageUrl` is what the
          // json says, and has no setter
          context.imageUrl.set(this.overrideImageUrl ?? this.atlasJson.meta.image);
        }
      },
      [atlasJsonSignal, overrideImageUrlSignal],
      {attach: this},
    );

    createEffect(
      () => {
        context.clearFailure('atlasParse');
        const atlasJson = this.atlasJson;
        // Nothing on the resource may have been built from a json other than the current
        // one. The animations go back here as well, for the same reason as in the tile set
        // effect: inside a batch the animation effect runs after this one, and an error
        // listener reading the resource would still find them. The texture stays.
        const takeBack = () => {
          context.atlas.set(undefined);
          context.adapterAnimations.set(undefined);
          context.frameBasedAnimations.set(undefined);
        };
        if (!atlasJson) {
          takeBack();
          return;
        }
        const imageCoords = this.imageCoords;
        if (!imageCoords) {
          // without an image nothing is built from one
          takeBack();
          return;
        }
        // an atlas describes the image its json names. While the image effect is still
        // on its way to that image, the atlas of the one before stays published — it is
        // not cleared, because a subscriber would get an `undefined` where the event
        // type promises a TextureAtlas. The run this skips is taken up again as soon as
        // the image arrives: that is what `imageUrlOfCoords` sits in the dependencies
        // for
        if (context.imageUrlOfCoords.value !== (this.overrideImageUrl ?? atlasJson.meta.image)) return;
        let atlas: TextureAtlas;
        let adapterAnimations: FrameBasedAnimations | undefined;
        try {
          const adapter = atlasAdapterSignal.value ?? (this[atlasAdapterPicker] ?? pickBuiltInAtlasAdapter)(atlasJson);
          const result: unknown = adapter(atlasJson, imageCoords);
          const answered = (typeof result === 'object' && result !== null ? result : {}) as Partial<AtlasAdapterResultShape>;
          if (!(answered.atlas instanceof TextureAtlas)) {
            throw new Error(
              `TextureResource: the atlas adapter of resource "${this.id}" answered no atlas — an adapter answers {atlas, animations?}`,
            );
          }
          if (answered.animations !== undefined && !(answered.animations instanceof FrameBasedAnimations)) {
            throw new Error(
              `TextureResource: the atlas adapter of resource "${this.id}" answered animations that are no FrameBasedAnimations — an adapter answers a FrameBasedAnimations or none`,
            );
          }
          atlas = answered.atlas;
          adapterAnimations = answered.animations;
        } catch (error) {
          // reported instead of thrown: thrown, it would reach whoever wrote the json — the
          // `atlasJson` setter, a `TextureStore#parse()` — or the image effect, whose load
          // would then end as a texture failure
          takeBack();
          context.fail('atlasParse', {source: 'texture', id: this.id, error});
          return;
        }
        // one batch: the animations effect reads both, and runs once for the pair
        const built = atlas;
        batch(() => {
          context.adapterAnimations.set(adapterAnimations);
          context.atlas.set(built);
        });
      },
      [atlasJsonSignal, atlasAdapterSignal, context.imageCoords, context.imageUrlOfCoords],
      {attach: this, priority: DERIVED_FROM_IMAGE_PRIORITY},
    );

    context.registerAnimationsEffect(
      context.atlas,
      (animations, name, data, atlas) => {
        const shape = animationDataShape(data);
        if (shape !== 'frameNameQuery') throw wrongAnimationDataError(this, name, shape);
        // the entry goes in as the timing: add() reads its duration or frameRate, and it is the one
        // place that refuses an entry carrying neither, with the name of the animation
        if ('frameNameQuery' in data) animations.add(name, data, atlas, data.frameNameQuery);
      },
      context.adapterAnimations,
    );

    // activate() takes up what the resource holds at this call as if it were written right after
    // it. These effects have static dependencies and run on a change alone: a json written before
    // the call builds its atlas once touched, and the fetch of `atlasUrl` starts only while it is
    // due — an `atlasJson` written after that url takes its place, as it cuts short a fetch under
    // way
    if (atlasJsonSignal.value !== undefined) touch(atlasJsonSignal);
    if (this.#atlasFetchDue) touch(atlasUrlSignal);
  }
}

/**
 * A resource of any of the three shapes, as `TextureStore` hands it out. Its `type` narrows it to
 * the class of its shape: after `resource.type === 'atlas'` it is an {@link AtlasTextureResource}.
 */
export type AnyTextureResource = ImageTextureResource | TileSetTextureResource | AtlasTextureResource;

// The inputs of one shape stand on the class of that shape alone, and TypeScript refuses a write to
// them on another: no type of that shape names them. JavaScript, the browser tests among it, would
// quietly create an own property the resource never reads, and reading it back would answer the
// value written. These accessors on the prototype of each shape catch it — the getter answers
// `undefined`, the setter throws, and on a disposed resource it stays silent. No type names them.
const refuseInputsOfOtherShapes = (shape: {readonly prototype: TextureResource}, inputs: readonly string[]): void => {
  for (const input of inputs) {
    Object.defineProperty(shape.prototype, input, {
      configurable: true,
      get: () => undefined,
      set(this: TextureResource, _value: unknown) {
        if (shapeContextOf(this).isDisposed()) return;
        throw wrongShapeError(this, input);
      },
    });
  }
};

refuseInputsOfOtherShapes(ImageTextureResource, [
  'tileSetOptions',
  'atlasUrl',
  'atlasJson',
  'overrideImageUrl',
  'atlasAdapter',
  'frameBasedAnimationsData',
]);
refuseInputsOfOtherShapes(TileSetTextureResource, ['atlasUrl', 'atlasJson', 'overrideImageUrl', 'atlasAdapter']);
refuseInputsOfOtherShapes(AtlasTextureResource, ['tileSetOptions']);

// `imageUrl` of an atlas is read-only for TypeScript; the getter of the base alone would make a
// write from JavaScript throw a TypeError that says nothing of `overrideImageUrl`
Object.defineProperty(AtlasTextureResource.prototype, 'imageUrl', {
  configurable: true,
  get: Object.getOwnPropertyDescriptor(TextureResource.prototype, 'imageUrl')?.get,
  set(this: AtlasTextureResource, _value: unknown) {
    if (shapeContextOf(this).isDisposed()) return;
    throw derivedImageUrlError(this);
  },
});
