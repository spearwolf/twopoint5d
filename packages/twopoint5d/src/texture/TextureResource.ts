import {emit, type EventizedObject, eventize, off, retain, retainClear} from '@spearwolf/eventize';
import type {Signal} from '@spearwolf/signalize';
import {batch, createEffect, createSignal, SignalGroup, touch} from '@spearwolf/signalize';
import type {WebGPURenderer} from 'three/webgpu';
import {ImageLoader, type Texture} from 'three/webgpu';
import {FrameBasedAnimations, type AnimationTimingOptions} from './FrameBasedAnimations.js';
import {isAtlasJsonResponse, type AtlasJsonResponse} from './isAtlasJsonResponse.js';
import type {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';
import {TileSet, type TileSetOptions} from './TileSet.js';
import type {FrameBasedAnimationsData, FrameBasedAnimationsDataMap} from './types.js';

/**
 * Extracts timing options from frame-based animation data.
 * Returns AnimationTimingOptions object with either duration or frameRate.
 * @throws Error if neither duration nor frameRate is provided
 */
const getTimingOptions = (data: FrameBasedAnimationsData): AnimationTimingOptions => {
  if ('frameRate' in data && data.frameRate !== undefined) {
    return {frameRate: data.frameRate};
  }
  if ('duration' in data && data.duration !== undefined) {
    return {duration: data.duration};
  }
  throw new Error('Either duration or frameRate must be provided in animation data');
};

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
 * set — with no `url`, since none has failed. A tile set that `TileSet` refuses is reported
 * here whether the image arrives or the `tileSetOptions` change; the write that changed them
 * does not throw. An `atlasJson` that `TexturePackerJson` cannot read is reported here as soon
 * as the image it names is there; the write that set it does not throw either. It carries
 * `{source: 'frameBasedAnimations', id, animation, error}` for an animation entry that is
 * skipped: one whose data is no object or does not fit this kind of resource, and one whose data does not
 * let the animation be built — no `duration` and no `frameRate`, or a `frameRate` of 0.
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

// An animation entry that carries the data of another kind of resource is skipped, and
// this is what says so: a tile range on an atlas, a frame name query on a tile set, or an
// entry that names no frames at all.
const wrongAnimationDataError = (resource: TextureResource, animation: string, shape: string | undefined) => ({
  source: 'frameBasedAnimations',
  id: resource.id,
  animation,
  error: new Error(
    `[TextureResource] animation "${animation}" of resource "${resource.id}" carries ${shape ?? 'no known'} data, which a "${resource.type}" resource cannot use`,
  ),
});

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
    `TextureResource "${resource.id}" is an "atlas" resource and takes its "imageUrl" from the atlas json — write "overrideImageUrl" instead`,
  );

interface TextureImageSource {
  acquire(url: string): Promise<HTMLImageElement>;
  release(url: string): void;
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
 * **Output** — read-only, produced by the effects {@link TextureResource.load} registers:
 * `imageCoords`, `atlas`, `tileSet`, `texture` and `frameBasedAnimations`. Each of them is
 * also an event of the same name, retained, so a subscriber that arrives late still sees
 * the current value. A tile set resource takes its `tileSet`, `atlas` and `frameBasedAnimations`
 * back while its `tileSetOptions` are cleared or refused by `TileSet`, and an atlas resource
 * takes its `atlas` and `frameBasedAnimations` back while its `atlasJson` is cleared or cannot
 * be read — the texture stays in both cases. Every resource takes its `frameBasedAnimations`
 * back while its `frameBasedAnimationsData` is cleared. The getters answer `undefined`, and
 * rather than announcing `undefined` the retained events are cleared, so a subscriber that
 * arrives later waits for the next value.
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
      resource.#tileSetOptions = createSignal<TileSetOptions | undefined>(tileSetOptions, {
        compare: cmpShallow,
        attach: resource,
      });
      resource.#tileSet = createSignal(undefined, {attach: resource});
      resource.#atlas = createSignal(undefined, {attach: resource});
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
      resource.#atlasUrl = createSignal<string | undefined>(atlasUrl, {attach: resource});
      resource.#atlasJson = createSignal(undefined, {attach: resource});
      resource.#fetchedAtlasJson = createSignal<AtlasJsonResponse | undefined>(undefined, {attach: resource});
      resource.#atlas = createSignal(undefined, {attach: resource});
      resource.#overrideImageUrl = createSignal<string | undefined>(overrideImageUrl, {attach: resource});
      resource.textureClasses = textureClasses?.slice();
      resource.frameBasedAnimationsData = frameBasedAnimations;
    });

    return resource;
  }

  #atlasUrl?: Signal<string | undefined>;
  #atlasJson?: Signal<TexturePackerJsonData | undefined>;
  // the json as `atlasUrl` delivered it, without the image url resolved into it
  #fetchedAtlasJson?: Signal<AtlasJsonResponse | undefined>;
  #overrideImageUrl?: Signal<string | undefined>;
  #atlas?: Signal<TextureAtlas | undefined>;
  #tileSetOptions?: Signal<TileSetOptions | undefined>;
  #tileSet?: Signal<TileSet | undefined>;

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

  refCount: number = 0;

  // Every getter of this class answers `undefined` once dispose() has run. A setter needs
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
    return this.#disposed ? undefined : this.#atlasUrl?.value;
  }

  set atlasUrl(value: string | undefined) {
    if (this.#disposed) return;
    if (!this.#atlasUrl) throw wrongShapeError(this, 'atlasUrl');
    this.#atlasUrl.set(value);
  }

  /**
   * The atlas json of an atlas resource. For a json fetched from `atlasUrl`, `meta.image` names
   * the image the texture is built from: the `overrideImageUrl` while one is set, the image the
   * json names otherwise. A json written from outside replaces the fetched one.
   *
   * While it is cleared, the resource offers no `atlas` and no `frameBasedAnimations`. A json
   * that `TexturePackerJson` cannot read takes both back as well and is reported as an `error`
   * with `source: 'texture'` once the image it names is there; writing it does not throw.
   */
  get atlasJson(): TexturePackerJsonData | undefined {
    return this.#disposed ? undefined : this.#atlasJson?.value;
  }

  set atlasJson(value: TexturePackerJsonData | undefined) {
    if (this.#disposed) return;
    if (!this.#atlasJson) throw wrongShapeError(this, 'atlasJson');
    // a json written from outside replaces the fetched one: a later change of the
    // `overrideImageUrl` must not bring the fetched json back in its place
    this.#fetchedAtlasJson?.set(undefined);
    this.#atlasJson.set(value);
  }

  get overrideImageUrl(): string | undefined {
    return this.#disposed ? undefined : this.#overrideImageUrl?.value;
  }

  set overrideImageUrl(value: string | undefined) {
    if (this.#disposed) return;
    if (!this.#overrideImageUrl) throw wrongShapeError(this, 'overrideImageUrl');
    this.#overrideImageUrl.set(value);
  }

  get atlas(): TextureAtlas | undefined {
    return this.#disposed ? undefined : this.#atlas?.value;
  }

  get tileSetOptions(): TileSetOptions | undefined {
    return this.#disposed ? undefined : this.#tileSetOptions?.value;
  }

  set tileSetOptions(value: TileSetOptions | undefined) {
    if (this.#disposed) return;
    if (!this.#tileSetOptions) throw wrongShapeError(this, 'tileSetOptions');
    this.#tileSetOptions.set(value);
  }

  get tileSet(): TileSet | undefined {
    return this.#disposed ? undefined : this.#tileSet?.value;
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
   * de-duplicating loader here; a resource on its own falls back to a plain `ImageLoader`.
   *
   * `acquire()` and `release()` are paired: every run of the image effect acquires once and
   * releases in its cleanup, which is what lets the store drop a cached image once no
   * resource wants it any more.
   *
   * @internal
   */
  imageLoader?: TextureImageSource;

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

  #load = false;
  #disposed = false;

  constructor(id: string, type: TextureResourceType) {
    eventize(this);

    this.id = id;
    this.type = type;

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
   * this was. A write to any setter, a {@link TextureResource.load} and a second
   * `dispose()` do nothing — a setter that would throw on the shape of this resource
   * stays silent as well.
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

    SignalGroup.delete(this);
    off(this);
  }

  /**
   * Register the effects that turn the data of this resource into an atlas, a tile set
   * and a texture, and return `this`. Calling it more than once registers them once.
   *
   * Which effects are registered follows the shape of the resource, whatever values it holds
   * at the call: a `tileSetOptions` or an `atlasUrl` that is empty now and set later still
   * reaches them.
   *
   * It fetches nothing by itself: the effects do that, once the resource has what they
   * read. The two `TextureStore` methods of the same name do the fetching — the instance
   * method into an existing store, the static one into a store it builds for the attempt.
   *
   * On a disposed resource this does nothing — no effect and no signal is created — and
   * returns `this`.
   */
  load(): TextureResource {
    if (this.#disposed) return this;

    if (!this.#load) {
      this.#load = true;

      // A value that is taken back is not announced: a subscriber would get an `undefined`
      // where the event promises a value. The retained event is cleared instead, so a
      // subscriber that arrives later waits for the next value rather than being handed
      // the one that was taken back.
      const publish = <T>(signal: Signal<T | undefined> | undefined, event: TextureResourceSubType) => {
        signal?.onChange((value) => {
          if (value === undefined) {
            retainClear(this, event);
          } else {
            emit(this, event, value);
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

      // auto-tracking effect (no static deps) so it autoruns at registration
      // — load() is typically called AFTER `textureFactory` and `imageUrl` are
      // already set on the resource (by the store's parse-time injection), and
      // a static-dep effect would otherwise never fire because no dep changes
      // post-registration.
      createEffect(
        () => {
          const factory = this.#textureFactory.get();
          const url = this.#imageUrl.get();
          const classes = this.#textureClasses.get();
          if (!factory || !url) return;

          let aborted = false;
          let texture: Texture | undefined;

          // read once and used for both halves of the pair, so a field that is reassigned
          // between the two cannot make this run release what it never acquired
          const source = this.imageLoader;

          (source ? source.acquire(url) : new ImageLoader().loadAsync(url))
            .then(
              (image) => {
                if (aborted) return;
                texture = factory.create(image, ...(classes ?? []));
                texture.name = this.id;
                // The resource owns the texture before it publishes it: a subscriber that throws
                // inside the batch, or one that disposes this resource, cannot skip the handover —
                // dispose() releases whatever is owned at that moment. The predecessor stays alive
                // while it is still the published value and is released only after the batch, once
                // the successor is on the signal and no reader can reach it
                const previous = this.#ownTexture;
                this.#ownTexture = texture;
                try {
                  // one batch: the three values reach their effects together, and the higher
                  // priority of everything derived from the image — the atlas among it — puts
                  // those runs ahead of the bridge that carries the texture out
                  batch(() => {
                    this.#imageUrlOfCoords.set(url);
                    this.#imageCoords.set(new TextureCoords(0, 0, image.width, image.height));
                    this.#texture.set(texture);
                  });
                } finally {
                  previous?.dispose();
                }
              },
              (error) => {
                // the second parameter of .then() sees exactly the rejection of the image load
                // this promise wraps — the one case an `{source: 'image', url}` describes
                if (aborted) return;
                emit(this, OnError, {source: 'image', url, error});
              },
            )
            .catch((error) => {
              // texture creation that throws lands here, and so does a subscriber of an event
              // that throws inside the batch() above: signalize propagates inline, isolates the
              // throw and rethrows it to the writer once delivery ends, several at once as an
              // AggregateError. The writer here is the batch() itself, so it surfaces here, long
              // after the image fetch has already succeeded — there is no failed url to name, so
              // this reports the resource instead
              if (aborted) return;
              emit(this, OnError, {source: 'texture', id: this.id, error});
            });

          return () => {
            // a texture that reached the signal outlives this run and is released by the run
            // that replaces it, or by dispose() — freeing it here would leave the signal
            // pointing at a texture that is already gone
            aborted = true;
            source?.release(url);
          };
        },
        {attach: this},
      );

      // The shape of the resource decides which effects run, not the values it holds when this is
      // called: a value that arrives later has to reach them. Only fromTileSet() and fromAtlas()
      // create the signals of their shape — a resource built directly with `new TextureResource(id,
      // type)` has none of them and therefore gets none of these effects.
      const tileSetOptionsSignal = this.#tileSetOptions;
      const tileSetSignal = this.#tileSet;
      const tileSetAtlasSignal = this.#atlas;

      if (tileSetOptionsSignal && tileSetSignal && tileSetAtlasSignal) {
        createEffect(
          () => {
            const imageCoords = this.imageCoords;
            if (!imageCoords) return;
            const options = this.tileSetOptions;

            let tileSet: TileSet | undefined;
            let refusal: {error: unknown} | undefined;
            if (options) {
              try {
                tileSet = new TileSet(imageCoords, options);
              } catch (error) {
                refusal = {error};
              }
            }

            if (tileSet) {
              tileSetSignal.set(tileSet);
              tileSetAtlasSignal.set(tileSet.atlas);
              return;
            }

            // Nothing on the resource may have been built from options other than the current
            // ones, so without a tile set from the current options the tile set, its atlas and
            // the animations built on it are taken back — the animations here as well, because
            // inside a batch the animation effect runs after this one and an error listener
            // reading the resource would still find them. A refusal is reported here instead of
            // thrown: thrown, it would reach whoever wrote the options — a setter, a
            // `TextureStore#parse()` cut short before its ready event — or the image effect,
            // whose load would then end as a texture failure.
            tileSetSignal.set(undefined);
            tileSetAtlasSignal.set(undefined);
            this.#frameBasedAnimations.set(undefined);

            if (refusal) {
              emit(this, OnError, {source: 'texture', id: this.id, error: refusal.error});
            }
          },
          [this.#imageCoords, tileSetOptionsSignal],
          {attach: this, priority: DERIVED_FROM_IMAGE_PRIORITY},
        );

        createEffect(
          () => {
            const tileSet = this.tileSet;
            const animationsData = this.frameBasedAnimationsData;
            // animations come only out of the current tile set and the current data; without
            // either of them they are taken back, which clears the retained event
            if (!tileSet || !animationsData) {
              this.#frameBasedAnimations.set(undefined);
              return;
            }
            // published as one finished object: a subscriber that reads it in the change
            // callback would otherwise see an animation set that is still filling up
            const animations = new FrameBasedAnimations();
            for (const [name, data] of Object.entries(animationsData)) {
              const shape = animationDataShape(data);
              if (shape !== 'tileIds' && shape !== 'firstTileId') {
                emit(this, OnError, wrongAnimationDataError(this, name, shape));
                continue;
              }
              try {
                const timing = getTimingOptions(data);
                if ('tileIds' in data) {
                  animations.add(name, timing, tileSet, data.tileIds);
                } else if ('firstTileId' in data) {
                  animations.add(name, timing, tileSet, data.firstTileId, data.tileCount);
                }
              } catch (error) {
                // One bad entry skips itself. Without this the throw leaves the effect through the
                // global error channel of signalize, no animation of the whole map is registered,
                // and the caller is told nothing.
                emit(this, OnError, {source: 'frameBasedAnimations', id: this.id, animation: name, error});
              }
            }
            this.#frameBasedAnimations.set(animations);
          },
          [tileSetSignal, this.#frameBasedAnimationsData],
          {attach: this},
        );
      }

      // guarded by the signals of the shape as well, for the same reason as the tile set above
      const atlasUrlSignal = this.#atlasUrl;
      const atlasJsonSignal = this.#atlasJson;
      const fetchedAtlasJsonSignal = this.#fetchedAtlasJson;
      const overrideImageUrlSignal = this.#overrideImageUrl;
      const atlasSignal = this.#atlas;

      if (atlasUrlSignal && atlasJsonSignal && fetchedAtlasJsonSignal && overrideImageUrlSignal && atlasSignal) {
        createEffect(
          () => {
            const atlasUrl = this.atlasUrl;
            if (!atlasUrl) return;
            const ac = new AbortController();
            let aborted = false;
            (async () => {
              try {
                const response = await fetch(atlasUrl, {signal: ac.signal});
                if (aborted) return;
                if (!response.ok) {
                  // without this check, a 4xx/5xx body that happens to satisfy
                  // isAtlasJsonResponse below would be taken for a valid atlas, and the status
                  // this branch reports would be lost
                  emit(this, OnError, {
                    source: 'atlas',
                    url: atlasUrl,
                    status: response.status,
                    error: new Error(`[TextureResource] fetch("${atlasUrl}") answered ${response.status} ${response.statusText}`),
                  });
                  return;
                }
                const atlasJson = await response.json();
                if (aborted) return;

                if (!isAtlasJsonResponse(atlasJson)) {
                  emit(this, OnError, {
                    source: 'atlas',
                    url: atlasUrl,
                    error: new Error(`[TextureResource] the response of "${atlasUrl}" is no texture atlas json`),
                  });
                  return;
                }

                fetchedAtlasJsonSignal.set(atlasJson);
              } catch (error) {
                if (aborted) return;
                emit(this, OnError, {source: 'atlas', url: atlasUrl, error});
              }
            })();
            return () => {
              aborted = true;
              ac.abort();
            };
          },
          [atlasUrlSignal],
          {attach: this},
        );

        createEffect(
          () => {
            const fetched = fetchedAtlasJsonSignal.value;
            if (!fetched) return;
            const imageUrl = this.overrideImageUrl ?? fetched.meta.image;
            if (typeof imageUrl !== 'string') {
              // the json that is published stays as it was: a subscriber would get an `undefined`
              // where the event type promises a value
              emit(this, OnError, {
                source: 'atlas',
                url: this.atlasUrl,
                error: new Error(
                  `[TextureResource] the response of "${this.atlasUrl}" names no image and no overrideImageUrl was given`,
                ),
              });
              return;
            }
            // the resolved url goes into the published json, mirroring `TextureAtlasLoader`: `atlasJson`
            // is typed as `TexturePackerJsonData`, whose `meta.image` is a `string`, so the resolved url
            // has to land in the json itself rather than in a cast that would let the getter lie. The json
            // as it came stays in `#fetchedAtlasJson`, so an override that is cleared again gives the image
            // back to the one the json names. Written straight onto the signal, because the public setter
            // treats a write as a json from outside and drops the fetched one
            atlasJsonSignal.set({...fetched, meta: {...fetched.meta, image: imageUrl}});
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
            if (!imageCoords) return;
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
              emit(this, OnError, {source: 'texture', id: this.id, error});
              return;
            }
            atlasSignal.set(atlas);
          },
          [atlasJsonSignal, this.#imageCoords, this.#imageUrlOfCoords],
          {attach: this, priority: DERIVED_FROM_IMAGE_PRIORITY},
        );

        createEffect(
          () => {
            const atlas = this.atlas;
            const animationsData = this.frameBasedAnimationsData;
            // animations come only out of the current atlas and the current data; without
            // either of them they are taken back, which clears the retained event
            if (!atlas || !animationsData) {
              this.#frameBasedAnimations.set(undefined);
              return;
            }
            const animations = new FrameBasedAnimations();
            for (const [name, data] of Object.entries(animationsData)) {
              const shape = animationDataShape(data);
              if (shape !== 'frameNameQuery') {
                emit(this, OnError, wrongAnimationDataError(this, name, shape));
                continue;
              }
              try {
                const timing = getTimingOptions(data);
                if ('frameNameQuery' in data) {
                  animations.add(name, timing, atlas, data.frameNameQuery);
                }
              } catch (error) {
                // One bad entry skips itself. Without this the throw leaves the effect through the
                // global error channel of signalize, no animation of the whole map is registered,
                // and the caller is told nothing.
                emit(this, OnError, {source: 'frameBasedAnimations', id: this.id, animation: name, error});
              }
            }
            this.#frameBasedAnimations.set(animations);
          },
          [atlasSignal, this.#frameBasedAnimationsData],
          {attach: this},
        );

        touch(atlasUrlSignal);
      }

      // Standalone fallback: if a user assigns `renderer` directly on this resource
      // (i.e. without going through a `TextureStore`), spin up a per-resource
      // `TextureFactory`. When the resource is managed by a store, the store
      // injects its shared factory and this branch never fires.
      createEffect(
        () => {
          const renderer = this.#renderer.get();
          if (renderer && !this.#textureFactory.value) {
            this.textureFactory = new TextureFactory(renderer);
          }
        },
        {attach: this},
      );
    }
    return this;
  }
}
