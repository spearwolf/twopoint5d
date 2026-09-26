import {emit, emitStrict, type EventizedObject, eventize, off, retain, retainClear} from '@spearwolf/eventize';
import type {Signal} from '@spearwolf/signalize';
import {batch, createEffect, createSignal, SignalGroup, touch} from '@spearwolf/signalize';
import type {WebGPURenderer} from 'three/webgpu';
import {ImageLoader, type Texture} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {FrameBasedAnimations} from './FrameBasedAnimations.js';
import {
  changeRefCount,
  imageSource,
  type ImageLease,
  loadFailureFor,
  type TextureImageSource,
  type TextureResourceLoadFailure,
} from './internals.js';
import {isAtlasJsonResponse, type AtlasJsonResponse} from './isAtlasJsonResponse.js';
import {resolveRelativeUrl} from './resolveRelativeUrl.js';
import type {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';
import {TileSet, type TileSetOptions} from './TileSet.js';
import type {FrameBasedAnimationsData, FrameBasedAnimationsDataMap} from './types.js';

type FrameBasedAnimationsDataShape = 'frameNameQuery' | 'tileIds' | 'firstTileId';

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
 * The per-subtype events (`imageCoords`, `atlas`, `tileSet`, `texture`,
 * `frameBasedAnimations`) are retained — late subscribers see the latest value.
 * A value the resource takes back is not announced: rather than carrying `undefined`, its
 * retained event is cleared, and a subscriber that arrives later waits for the next value.
 * {@link TextureResource} lists when a value is taken back.
 *
 * `error` carries `{source: 'image'|'atlas', url, error}` for a fetch that failed, with a
 * `status: number` beside it when the atlas request answered with a status instead of a body —
 * an image that does not load comes out of the loader promise and has no status to name. The
 * same `source: 'atlas'` also carries `{url, error}` with no `status` for a fetch that
 * succeeded but answered with something that is not a texture atlas json, or with one that
 * names no image and was given no `overrideImageUrl` to fall back on, or whose `overrideImageUrl`
 * is cleared again — the response was a 200, so there is no status to name. It
 * carries `{source: 'texture', id, error}` for a failure behind an image that loaded
 * successfully — texture creation, or any value derived from it, such as an atlas or a tile
 * set — with no `url`, since none has failed. A subscriber of `imageCoords`, `atlas`, `tileSet`,
 * `texture` or `frameBasedAnimations` that throws keeps the value from no one: every other
 * subscriber is called and the retained value is written before the throw goes on. A throw
 * raised while the resource publishes what it loaded — its image, its atlas json and what is
 * built from them — is reported with the same `{source: 'texture', id, error}`; the value stays
 * published, and `TextureStore#getAsync()` does not reject on it. A tile set that `TileSet` refuses
 * is reported here whether the image arrives or the `tileSetOptions` change; the write that changed them
 * does not throw. An `atlasJson` that `TexturePackerJson` cannot read is reported here as soon
 * as the image it names is there; the write that set it does not throw either. It carries
 * `{source: 'frameBasedAnimations', id, animation, error}` for an animation entry that is
 * skipped: one whose data is no object or does not fit this kind of resource, one whose data does not
 * let the animation be built — no `duration` and no `frameRate`, a `frameRate` of 0, `tileIds` that
 * are no array, a tile id, a `firstTileId` or a `tileCount` that `FrameBasedAnimations#add()` refuses,
 * a `frameNameQuery` that is neither a string nor a `RegExp` — and one whose frames come out empty,
 * a `frameNameQuery` that matches nothing or an empty list of `tileIds`.
 * Every other entry of the same map is registered all the same.
 * `dispose` fires once at the start of `dispose()`.
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

// An animation entry that carries the data of another kind of resource is skipped — a tile
// range on an atlas, a frame name query on a tile set, or an entry that names no frames at
// all — and this is the error it is skipped with.
const wrongAnimationDataError = (resource: TextureResource, animation: string, shape: string | undefined): Error =>
  new Error(
    `[TextureResource] animation "${animation}" of resource "${resource.id}" carries ${shape ?? 'no known'} data, ` +
      `which a "${resource.type}" resource cannot use`,
  );

// Only the shape of resource a property belongs to carries the signal behind it. Without
// this the write would go nowhere and the getter next to it would keep answering
// `undefined`, leaving the caller with no sign that the value never arrived.
const wrongShapeError = (resource: TextureResource, property: string): TypeError => {
  const article = /^[aeiou]/.test(resource.type) ? 'an' : 'a';
  return new TypeError(`TextureResource "${resource.id}" is ${article} "${resource.type}" resource and has no "${property}"`);
};

// An atlas resource takes the name of its image from its json. Writing that name from
// outside would put the texture on one file while the atlas keeps describing another, and
// nothing would ever bring the two back together: the json still names what it named, so
// the atlas effect finds no reason to publish again and no error is raised either.
const derivedImageUrlError = (resource: TextureResource): TypeError =>
  new TypeError(
    `TextureResource "${resource.id}" is an "atlas" resource and takes its "imageUrl" from the atlas json ` +
      `— write "overrideImageUrl" instead`,
  );

// the inputs only an atlas resource carries
interface AtlasSignals {
  readonly atlasUrl: Signal<string | undefined>;
  readonly atlasJson: Signal<TexturePackerJsonData | undefined>;
  // the json as `atlasUrl` delivered it, with a relative `meta.image` resolved against that url,
  // but without the `overrideImageUrl` put in its place
  readonly fetchedAtlasJson: Signal<FetchedAtlasJson | undefined>;
  readonly overrideImageUrl: Signal<string | undefined>;
}

// `url` is the url this json came from — `atlasUrl` may already name the next one
interface FetchedAtlasJson {
  readonly json: AtlasJsonResponse;
  readonly url: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TextureResource extends EventizedObject {}

/**
 * A single entry of a `TextureStore`: an image, a tile set or a texture atlas,
 * turned into a `Texture` and whatever else its shape brings with it.
 *
 * The properties fall into two groups.
 *
 * **Input** — write these to say what the resource is made of: `imageUrl`, `atlasUrl`,
 * `atlasJson`, `overrideImageUrl`, `tileSetOptions`, `frameBasedAnimationsData`,
 * `textureClasses`, `textureFactory` and `renderer`. `atlasJson` is both: an atlas
 * resource with an `atlasUrl` fetches the JSON and writes it here itself.
 *
 * **Output** — read-only, produced by the effects {@link TextureResource.activate} registers:
 * `imageCoords`, `atlas`, `tileSet`, `texture` and `frameBasedAnimations`. Each of them is
 * also an event of the same name, retained, so a subscriber that arrives late still sees
 * the current value. A tile set resource takes its `tileSet`, `atlas` and `frameBasedAnimations`
 * back while its `tileSetOptions` are cleared or refused by `TileSet`, and an atlas resource
 * takes its `atlas` and `frameBasedAnimations` back while its `atlasJson` is cleared or cannot
 * be read once the image it names is there — the texture stays in both cases. Every resource
 * takes its `frameBasedAnimations` back while its `frameBasedAnimationsData` is cleared. The
 * getters answer `undefined`, and rather than announcing `undefined` the retained events are
 * cleared, so a subscriber that arrives later waits for the next value.
 *
 * An image or a tile set resource whose `imageUrl` is cleared takes its `imageCoords` and its
 * `texture` back the same way, together with everything built from them — the `tileSet`, its
 * `atlas` and the `frameBasedAnimations` — and releases the texture it built, since a
 * subscriber only borrows it. An image that is still loading when the url is cleared builds
 * nothing. An atlas resource whose json names no image, with no `overrideImageUrl` to fall back
 * on, has no `imageUrl` either and does the same. A `textureFactory` that is cleared takes
 * nothing back: the texture stays until the next factory builds one.
 *
 * `atlasUrl`, `atlasJson`, `overrideImageUrl` and `tileSetOptions` belong to one shape of
 * resource each. Writing one on a resource of another shape throws a `TypeError`.
 *
 * `imageUrl` changes sides with the shape: an image and a tile set are told which file to
 * load, an atlas takes that name from `overrideImageUrl ?? atlasJson.meta.image` and reads
 * as output. Writing it on an atlas resource throws a `TypeError` — `overrideImageUrl` is
 * the way to send one to another image, and it keeps the atlas and the texture together.
 */
export class TextureResource {
  static fromImage(id: string, imageUrl: string, textureClasses?: TextureOptionClasses[]): TextureResource {
    const resource = new TextureResource(id, 'image');

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
  ): TextureResource {
    const resource = new TextureResource(id, 'tileset');

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
  ): TextureResource {
    const resource = new TextureResource(id, 'atlas');

    batch(() => {
      resource.atlasUrl = atlasUrl;
      resource.overrideImageUrl = overrideImageUrl;
      resource.textureClasses = textureClasses?.slice();
      resource.frameBasedAnimationsData = frameBasedAnimations;
    });

    return resource;
  }

  // the inputs of one shape each, created by the constructor for that shape and no other: a
  // setter of another shape finds none and throws, and activate() registers the effects of the
  // shape they belong to
  readonly #tileSetOptions?: Signal<TileSetOptions | undefined>;
  readonly #atlasSignals?: AtlasSignals;

  // outputs sit on every resource, like the texture: a shape that builds no atlas or no tile
  // set leaves them `undefined`
  #atlas = createSignal<TextureAtlas | undefined>(undefined, {attach: this});
  #tileSet = createSignal<TileSet | undefined>(undefined, {attach: this});

  #frameBasedAnimations = createSignal<FrameBasedAnimations | undefined>(undefined, {attach: this});
  #frameBasedAnimationsData = createSignal<FrameBasedAnimationsDataMap | undefined>(undefined, {attach: this});

  #textureClasses = createSignal<TextureOptionClasses[] | undefined>(undefined, {compare: cmpTexClasses, attach: this});
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

  readonly id: string;
  readonly type: TextureResourceType;

  #refCount = 0;

  /**
   * How many `TextureStore#on()` subscriptions hold this resource, a pending
   * `TextureStore#getAsync()` among them. `TextureStore#clearUnused()` and
   * `TextureStore#parse()` with `{evictMissing: true}` dispose a resource only while this
   * is 0.
   *
   * Read-only: the store that holds the resource keeps the count.
   */
  get refCount(): number {
    return this.#refCount;
  }

  /** @internal */
  [changeRefCount](delta: 1 | -1): void {
    this.#refCount += delta;
  }

  // Every getter of this class answers `undefined` once dispose() has run, `refCount` aside:
  // that one goes on counting the subscriptions that still hold the resource. A setter needs
  // no guard against a write that arrives too late: once dispose() has returned,
  // SignalGroup.delete(this) has taken the change bridges and the effects down, so nothing
  // reads what such a write would still put into a signal. The setters that are tied to one
  // shape of resource check the flag all the same — they throw on the wrong shape, and a
  // disposed resource has to stay silent.
  get imageUrl(): string | undefined {
    return this.#disposed ? undefined : this.#imageUrl.value;
  }

  set imageUrl(val: string | undefined) {
    if (this.#disposed) return;
    // input on an image and a tile set, output on an atlas: there the atlas effect derives it
    if (this.type === 'atlas') throw derivedImageUrlError(this);
    this.#imageUrl.set(val);
  }

  get imageCoords(): TextureCoords | undefined {
    return this.#disposed ? undefined : this.#imageCoords.value;
  }

  get atlasUrl(): string | undefined {
    return this.#disposed ? undefined : this.#atlasSignals?.atlasUrl.value;
  }

  set atlasUrl(value: string | undefined) {
    if (this.#disposed) return;
    const signals = this.#atlasSignals;
    if (!signals) throw wrongShapeError(this, 'atlasUrl');
    if (value !== signals.atlasUrl.value) this.#atlasFetchDue = true;
    signals.atlasUrl.set(value);
  }

  /**
   * The atlas json of an atlas resource. For a json fetched from `atlasUrl`, `meta.image` names
   * the image the texture is built from: the `overrideImageUrl` while one is set, the image the
   * json names otherwise — a relative name resolved against `atlasUrl`, so it names the file
   * next to the json. The `overrideImageUrl` is taken as written. A json written from outside
   * replaces the fetched one and a fetch of `atlasUrl` that failed, and it cuts short a fetch
   * that is still under way: neither the json nor a failure of that fetch arrives after the
   * write. It has no url of its own and keeps its `meta.image` as written, and the image loader
   * resolves a relative one against the document.
   *
   * While it is cleared, the resource offers no `atlas` and no `frameBasedAnimations`. A json
   * that `TexturePackerJson` cannot read takes both back as well and is reported as an `error`
   * with `source: 'texture'` once the image it names is there; writing it does not throw.
   * Written before {@link TextureResource.activate}, it takes the place of the fetch of the
   * `atlasUrl` it was written after.
   */
  get atlasJson(): TexturePackerJsonData | undefined {
    return this.#disposed ? undefined : this.#atlasSignals?.atlasJson.value;
  }

  set atlasJson(value: TexturePackerJsonData | undefined) {
    if (this.#disposed) return;
    const signals = this.#atlasSignals;
    if (!signals) throw wrongShapeError(this, 'atlasJson');
    // a fetch of `atlasUrl` that is still under way, and a fetch that activate() has yet to
    // start, would replace this json once it arrives — through `#fetchedAtlasJson` and the atlas
    // image effect — and its failure would hold back what this json brings
    this.#atlasFetch?.abort();
    this.#atlasFetch = undefined;
    this.#atlasFetchDue = false;
    // a json written from outside replaces the fetched one: a later change of the
    // `overrideImageUrl` must not bring the fetched json back in its place
    signals.fetchedAtlasJson.set(undefined);
    // and a fetch that failed holds nothing back any more; its effect hangs off `atlasUrl`
    // alone and would not run again to clear the record
    this.#loadFailures.delete('atlasFetch');
    signals.atlasJson.set(value);
  }

  get overrideImageUrl(): string | undefined {
    return this.#disposed ? undefined : this.#atlasSignals?.overrideImageUrl.value;
  }

  set overrideImageUrl(value: string | undefined) {
    if (this.#disposed) return;
    const signals = this.#atlasSignals;
    if (!signals) throw wrongShapeError(this, 'overrideImageUrl');
    signals.overrideImageUrl.set(value);
  }

  get atlas(): TextureAtlas | undefined {
    return this.#disposed ? undefined : this.#atlas.value;
  }

  get tileSetOptions(): TileSetOptions | undefined {
    return this.#disposed ? undefined : this.#tileSetOptions?.value;
  }

  set tileSetOptions(value: TileSetOptions | undefined) {
    if (this.#disposed) return;
    const signal = this.#tileSetOptions;
    if (!signal) throw wrongShapeError(this, 'tileSetOptions');
    signal.set(value);
  }

  get tileSet(): TileSet | undefined {
    return this.#disposed ? undefined : this.#tileSet.value;
  }

  get frameBasedAnimations(): FrameBasedAnimations | undefined {
    return this.#disposed ? undefined : this.#frameBasedAnimations.value;
  }

  get frameBasedAnimationsData(): FrameBasedAnimationsDataMap | undefined {
    return this.#disposed ? undefined : this.#frameBasedAnimationsData.value;
  }

  set frameBasedAnimationsData(value: FrameBasedAnimationsDataMap | undefined) {
    this.#frameBasedAnimationsData.set(value);
  }

  get textureClasses(): TextureOptionClasses[] | undefined {
    return this.#disposed ? undefined : this.#textureClasses.value;
  }

  set textureClasses(value: TextureOptionClasses[] | undefined) {
    if (Array.isArray(value) && value.length === 0) {
      value = undefined;
    }
    this.#textureClasses.set(value);
  }

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

  // the failure each step last ended with, until that step runs again: a resource does not
  // try again by itself, and a getAsync() that comes after the failure has to see it all the
  // same. Only a step that ends without its result lands here — a subscriber that throws while
  // a result is published is no failure of the step: the result is there
  #loadFailures = new Map<LoadStep, TextureResourceLoadFailure>();

  // the atlas fetch under way, if there is one: the run of the fetch effect that started it
  // sets it and lets go of it when the fetch is over; that run's cleanup and the `atlasJson`
  // setter cut it short
  #atlasFetch?: AbortController;

  // whether activate() starts the fetch of `atlasUrl`: a url that changes makes it due, and an
  // `atlasJson` written after it takes its place, as it cuts short a fetch under way. Read by
  // activate() alone — once the effects are registered, a new url starts its fetch by itself
  #atlasFetchDue = false;

  #activated = false;
  #disposed = false;

  /**
   * A resource of the given `type`, with the inputs of that shape and of no other: an `'atlas'`
   * resource takes `atlasUrl`, `atlasJson` and `overrideImageUrl`, a `'tileset'` resource
   * `tileSetOptions`, and {@link TextureResource.activate} registers the effects of that shape.
   * The static factories {@link TextureResource.fromImage}, {@link TextureResource.fromTileSet}
   * and {@link TextureResource.fromAtlas} build one the same way and write its first values.
   */
  constructor(id: string, type: TextureResourceType) {
    eventize(this);

    this.id = id;
    this.type = type;

    if (type === 'tileset') {
      this.#tileSetOptions = createSignal<TileSetOptions | undefined>(undefined, {compare: cmpShallow, attach: this});
    } else if (type === 'atlas') {
      this.#atlasSignals = {
        atlasUrl: createSignal<string | undefined>(undefined, {attach: this}),
        atlasJson: createSignal<TexturePackerJsonData | undefined>(undefined, {attach: this}),
        fetchedAtlasJson: createSignal<FetchedAtlasJson | undefined>(undefined, {attach: this}),
        overrideImageUrl: createSignal<string | undefined>(undefined, {attach: this}),
      };
    }

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
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;

    emit(this, OnDispose);

    // the dispose event above is how subscribers learn this resource is gone; muting
    // keeps the clean-up below from following it with a texture update that would hand
    // a subscriber an undefined where the event type promises a Texture
    this.#texture.muted = true;
    this.#texture.set(undefined);

    // released only after the signal has given it up, so no reader can ever reach a
    // texture that is already freed
    this.#ownTexture?.dispose();
    this.#ownTexture = undefined;

    this.#loadFailures.clear();

    SignalGroup.delete(this);
    off(this);
  }

  // the record goes in before the event goes out: a listener of the error event reads it
  #fail(step: LoadStep, failure: TextureResourceLoadFailure): void {
    this.#loadFailures.set(step, failure);
    emit(this, OnError, failure);
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
   * Register the effects that turn the data of this resource into an atlas, a tile set
   * and a texture, and return `this`. Calling it more than once registers them once.
   *
   * Which effects are registered follows the `type` of the resource, whatever values it holds at
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
  activate(): TextureResource {
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

    // the type decides which effects run, not the values the resource holds at this call: the
    // inputs of its shape are there from the constructor on, and a value that arrives later
    // reaches the effects that read it
    if (this.#tileSetOptions) this.#registerTileSetEffects(this.#tileSetOptions);
    if (this.#atlasSignals) this.#registerAtlasEffects(this.#atlasSignals);

    // Standalone fallback: a resource on its own — its renderer written directly, with no
    // `TextureStore` around — builds a factory that starts from no texture class, as the factory
    // of a store does. A new renderer brings a new factory with its anisotropy maximum; a factory
    // written from outside, the shared one of a store among them, stays.
    //
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
  load(): TextureResource {
    return this.activate();
  }

  #registerImageEffect(): void {
    // auto-tracking effect (no static deps) so it autoruns at registration
    // — activate() is typically called AFTER `textureFactory` and `imageUrl` are
    // already set on the resource (by the store's parse-time injection), and
    // a static-dep effect would otherwise never fire because no dep changes
    // post-registration.
    createEffect(
      () => {
        // a new run is a new attempt; a run without a factory is a "not yet", one without a url
        // takes the image back
        this.#loadFailures.delete('image');
        const factory = this.#textureFactory.get();
        const url = this.#imageUrl.get();
        const classes = this.#textureClasses.get();
        // no url, no image: what was built from the last one is taken back. No factory is a "not
        // yet" instead — the texture of the last factory stays until the next one builds
        if (!url) {
          this.#takeBackImage();
          return;
        }
        if (!factory) return;

        let aborted = false;

        // one lease per run, given back by the cleanup of exactly this run: a source that is
        // swapped in between cannot make this run give back what it never took
        const lease: ImageLease | undefined = this[imageSource]?.acquire(url);

        // No closing .catch(): what either handler below still throws can only come from an
        // error listener that throws itself, and that is no failure of this step
        (lease?.image ?? new ImageLoader().loadAsync(url)).then(
          (image) => {
            if (aborted) return;
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
              emit(this, OnError, {source: 'texture', id: this.id, error: publishError.error});
            }
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

  // A cleared image takes back what was built from it: the coordinates and the texture here, and
  // with the coordinates the tile set, its atlas and the animations, in the effects that hang off
  // them. The texture was built here and is released here, once the signal has given it up, so no
  // reader reaches a texture that is already freed. Nothing is announced: the bridges clear the
  // retained events instead of handing a subscriber `undefined`
  #takeBackImage(): void {
    const previous = this.#ownTexture;
    this.#ownTexture = undefined;
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

  #registerTileSetEffects(tileSetOptions: Signal<TileSetOptions | undefined>): void {
    createEffect(
      () => {
        this.#loadFailures.delete('tileSet');
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
            this.#tileSet.set(built);
            this.#atlas.set(built.atlas);
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
        this.#tileSet.set(undefined);
        this.#atlas.set(undefined);
        this.#frameBasedAnimations.set(undefined);

        if (refusal) {
          this.#fail('tileSet', {source: 'texture', id: this.id, error: refusal.error});
        }
      },
      [this.#imageCoords, tileSetOptions],
      {attach: this, priority: DERIVED_FROM_IMAGE_PRIORITY},
    );

    this.#registerAnimationsEffect(this.#tileSet, (animations, name, data, tileSet) => {
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
            `[TextureResource] animation "${name}" of resource "${this.id}" carries tileIds of ${describeValue(tileIds)} ` +
              `— tileIds is an array of tile ids`,
          );
        }
        animations.add(name, data, tileSet, data.tileIds);
      } else if ('firstTileId' in data) {
        animations.add(name, data, tileSet, data.firstTileId, data.tileCount);
      }
    });
  }

  #registerAtlasEffects(signals: AtlasSignals): void {
    const {
      atlasUrl: atlasUrlSignal,
      atlasJson: atlasJsonSignal,
      fetchedAtlasJson: fetchedAtlasJsonSignal,
      overrideImageUrl: overrideImageUrlSignal,
    } = signals;
    const atlasSignal = this.#atlas;

    createEffect(
      () => {
        this.#loadFailures.delete('atlasFetch');
        const atlasUrl = this.atlasUrl;
        if (!atlasUrl) return;
        const ac = new AbortController();
        this.#atlasFetch = ac;
        (async () => {
          // the try holds the fetch and nothing else: writing the json publishes whatever it
          // brings — with its image already there, the atlas within this very call — and a
          // subscriber that throws there is no failure of the fetch
          let result: {json: AtlasJsonResponse} | {failure: TextureResourceLoadFailure};
          try {
            const response = await fetch(atlasUrl, {signal: ac.signal});
            if (ac.signal.aborted) return;
            if (!response.ok) {
              // without this check, a 4xx/5xx body that happens to satisfy
              // isAtlasJsonResponse below would be taken for a valid atlas, and the status
              // this branch reports would be lost
              result = {
                failure: {
                  source: 'atlas',
                  url: atlasUrl,
                  status: response.status,
                  error: new Error(`[TextureResource] fetch("${atlasUrl}") answered ${response.status} ${response.statusText}`),
                },
              };
            } else {
              const atlasJson = await response.json();
              if (ac.signal.aborted) return;
              if (isAtlasJsonResponse(atlasJson)) {
                // a relative image name is a file next to the atlas json, and `atlasUrl` here is the url
                // this very json came from — the effect that picks the image may already see the next one
                const image = atlasJson.meta.image;
                result = {
                  json:
                    typeof image === 'string'
                      ? {...atlasJson, meta: {...atlasJson.meta, image: resolveRelativeUrl(image, atlasUrl)}}
                      : atlasJson,
                };
              } else {
                result = {
                  failure: {
                    source: 'atlas',
                    url: atlasUrl,
                    error: new Error(`[TextureResource] the response of "${atlasUrl}" is no texture atlas json`),
                  },
                };
              }
            }
          } catch (error) {
            if (ac.signal.aborted) return;
            result = {failure: {source: 'atlas', url: atlasUrl, error}};
          } finally {
            if (this.#atlasFetch === ac) this.#atlasFetch = undefined;
          }
          if ('failure' in result) {
            this.#fail('atlasFetch', result.failure);
            return;
          }
          try {
            fetchedAtlasJsonSignal.set({json: result.json, url: atlasUrl});
          } catch (error) {
            // signalize hands the throw of a subscriber to the writer once every effect has
            // run: the json and what is built from it are published, so no record is kept
            emit(this, OnError, {source: 'texture', id: this.id, error});
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
        this.#loadFailures.delete('atlasImage');
        const fetched = fetchedAtlasJsonSignal.value;
        if (!fetched) return;
        const {json, url} = fetched;
        const imageUrl = this.overrideImageUrl ?? json.meta.image;
        if (typeof imageUrl !== 'string') {
          // the json that is published stays as it was: a subscriber would get an `undefined`
          // where the event type promises a value
          this.#fail('atlasImage', {
            source: 'atlas',
            url,
            error: new Error(`[TextureResource] the response of "${url}" names no image and no overrideImageUrl was given`),
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
          // json says, and the setter that guards that turns a write away
          this.#imageUrl.set(this.overrideImageUrl ?? this.atlasJson.meta.image);
        }
      },
      [atlasJsonSignal, overrideImageUrlSignal],
      {attach: this},
    );

    createEffect(
      () => {
        this.#loadFailures.delete('atlasParse');
        const atlasJson = this.atlasJson;
        // Nothing on the resource may have been built from a json other than the current
        // one. The animations go back here as well, for the same reason as in the tile set
        // effect: inside a batch the animation effect runs after this one, and an error
        // listener reading the resource would still find them. The texture stays.
        const takeBack = () => {
          atlasSignal.set(undefined);
          this.#frameBasedAnimations.set(undefined);
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
        // the image arrives: that is what `#imageUrlOfCoords` sits in the dependencies
        // for
        if (this.#imageUrlOfCoords.value !== (this.overrideImageUrl ?? atlasJson.meta.image)) return;
        let atlas: TextureAtlas;
        try {
          [atlas] = TexturePackerJson.parse(atlasJson, imageCoords);
        } catch (error) {
          // reported instead of thrown: thrown, it would reach whoever wrote the json — the
          // `atlasJson` setter, a `TextureStore#parse()` — or the image effect, whose load
          // would then end as a texture failure
          takeBack();
          this.#fail('atlasParse', {source: 'texture', id: this.id, error});
          return;
        }
        atlasSignal.set(atlas);
      },
      [atlasJsonSignal, this.#imageCoords, this.#imageUrlOfCoords],
      {attach: this, priority: DERIVED_FROM_IMAGE_PRIORITY},
    );

    this.#registerAnimationsEffect(this.#atlas, (animations, name, data, atlas) => {
      const shape = animationDataShape(data);
      if (shape !== 'frameNameQuery') throw wrongAnimationDataError(this, name, shape);
      // the entry goes in as the timing: add() reads its duration or frameRate, and it is the one
      // place that refuses an entry carrying neither, with the name of the animation
      if ('frameNameQuery' in data) animations.add(name, data, atlas, data.frameNameQuery);
    });

    // activate() takes up what the resource holds at this call as if it were written right after
    // it. These effects have static dependencies and run on a change alone: a json written before
    // the call builds its atlas once touched, and the fetch of `atlasUrl` starts only while it is
    // due — an `atlasJson` written after that url takes its place, as it cuts short a fetch under
    // way
    if (atlasJsonSignal.value !== undefined) touch(atlasJsonSignal);
    if (this.#atlasFetchDue) touch(atlasUrlSignal);
  }

  // The animations of the current data, built out of the current tile set or atlas. `addEntry`
  // registers one entry or throws for it: an entry it throws for is skipped and reported, and every
  // other entry of the map is registered all the same
  #registerAnimationsEffect<S extends TileSet | TextureAtlas>(
    source: Signal<S | undefined>,
    addEntry: (animations: FrameBasedAnimations, name: string, data: FrameBasedAnimationsData, source: S) => void,
  ): void {
    createEffect(
      () => {
        const from = source.value;
        const animationsData = this.frameBasedAnimationsData;
        // animations come only out of the current source and the current data; without
        // either of them they are taken back, which clears the retained event
        if (!from || !animationsData) {
          this.#frameBasedAnimations.set(undefined);
          return;
        }
        // published as one finished object: a subscriber that reads it in the change
        // callback would otherwise see an animation set that is still filling up
        const animations = new FrameBasedAnimations();
        for (const [name, data] of Object.entries(animationsData)) {
          try {
            addEntry(animations, name, data, from);
          } catch (error) {
            // One bad entry skips itself. Without this the throw leaves the effect through the
            // global error channel of signalize, no animation of the whole map is registered,
            // and the caller is told nothing.
            emit(this, OnError, {source: 'frameBasedAnimations', id: this.id, animation: name, error});
          }
        }
        this.#frameBasedAnimations.set(animations);
      },
      [source, this.#frameBasedAnimationsData],
      {attach: this},
    );
  }
}
