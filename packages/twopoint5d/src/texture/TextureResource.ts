import {emit, type EventizedObject, eventize, off, retain} from '@spearwolf/eventize';
import type {Signal} from '@spearwolf/signalize';
import {batch, createEffect, createSignal, SignalGroup, touch} from '@spearwolf/signalize';
import type {WebGPURenderer} from 'three/webgpu';
import {ImageLoader, type Texture} from 'three/webgpu';
import {FrameBasedAnimations, type AnimationTimingOptions} from './FrameBasedAnimations.js';
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
 * entry that carries none of them.
 */
const animationDataShape = (data: FrameBasedAnimationsData): FrameBasedAnimationsDataShape | undefined => {
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
 * `error` carries `{source: 'image'|'atlas', url, error}` for a fetch that failed, and
 * `{source: 'frameBasedAnimations', id, animation, error}` for an animation entry whose
 * data does not fit this kind of resource — that entry is skipped.
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
 * the current value.
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
      resource.#atlas = createSignal(undefined, {attach: resource});
      resource.#overrideImageUrl = createSignal<string | undefined>(overrideImageUrl, {attach: resource});
      resource.textureClasses = textureClasses?.slice();
      resource.frameBasedAnimationsData = frameBasedAnimations;
    });

    return resource;
  }

  #atlasUrl?: Signal<string | undefined>;
  #atlasJson?: Signal<TexturePackerJsonData | undefined>;
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

  get atlasJson(): TexturePackerJsonData | undefined {
    return this.#disposed ? undefined : this.#atlasJson?.value;
  }

  set atlasJson(value: TexturePackerJsonData | undefined) {
    if (this.#disposed) return;
    if (!this.#atlasJson) throw wrongShapeError(this, 'atlasJson');
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

      // these bridges end with the signals they read: the signals are attached to this
      // resource, and SignalGroup.delete(this) in dispose() destroys them
      this.#imageCoords.onChange((value) => {
        emit(this, 'imageCoords', value);
      });

      this.#atlas?.onChange((value) => {
        emit(this, 'atlas', value);
      });

      this.#tileSet?.onChange((value) => {
        emit(this, 'tileSet', value);
      });

      this.#frameBasedAnimations.onChange((value) => {
        emit(this, 'frameBasedAnimations', value);
      });

      this.#texture.onChange((value) => {
        emit(this, 'texture', value);
      });

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
            .then((image) => {
              if (aborted) return;
              texture = factory.create(image, ...(classes ?? []));
              texture.name = this.id;
              // one batch: the three values reach their effects together, and the higher
              // priority of everything derived from the image — the atlas among it — puts
              // those runs ahead of the bridge that carries the texture out
              batch(() => {
                this.#imageUrlOfCoords.set(url);
                this.#imageCoords.set(new TextureCoords(0, 0, image.width, image.height));
                this.#texture.set(texture);
              });
              // the predecessor stayed alive while it was still the published value; now that
              // the successor is on the signal, no reader can reach the old one any more
              const previous = this.#ownTexture;
              this.#ownTexture = texture;
              previous?.dispose();
            })
            .catch((error) => {
              if (aborted) return;
              emit(this, OnError, {source: 'image', url, error});
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

      if (this.tileSetOptions) {
        // A tileset resource creates these signals in the same batch() that received the value the guard just read.
        const tileSetOptionsSignal = this.#tileSetOptions!;
        const tileSetSignal = this.#tileSet!;
        const atlasSignal = this.#atlas!;

        createEffect(
          () => {
            if (this.imageCoords && this.tileSetOptions) {
              const tileSet = new TileSet(this.imageCoords, this.tileSetOptions);
              tileSetSignal.set(tileSet);
              atlasSignal.set(tileSet.atlas);
            }
          },
          [this.#imageCoords, tileSetOptionsSignal],
          {attach: this, priority: DERIVED_FROM_IMAGE_PRIORITY},
        );

        createEffect(
          () => {
            const tileSet = this.tileSet;
            if (tileSet && this.frameBasedAnimationsData) {
              // published as one finished object: a subscriber that reads it in the change
              // callback would otherwise see an animation set that is still filling up
              const animations = new FrameBasedAnimations();
              for (const [name, data] of Object.entries(this.frameBasedAnimationsData)) {
                const shape = animationDataShape(data);
                if (shape !== 'tileIds' && shape !== 'firstTileId') {
                  emit(this, OnError, wrongAnimationDataError(this, name, shape));
                  continue;
                }
                const timing = getTimingOptions(data);
                if ('tileIds' in data) {
                  animations.add(name, timing, tileSet, data.tileIds);
                } else if ('firstTileId' in data) {
                  animations.add(name, timing, tileSet, data.firstTileId, data.tileCount);
                }
              }
              this.#frameBasedAnimations.set(animations);
            }
          },
          [tileSetSignal, this.#frameBasedAnimationsData],
          {attach: this},
        );
      }

      if (this.atlasUrl) {
        // An atlas resource creates these signals in the same batch() that received the value the guard just read.
        const atlasUrlSignal = this.#atlasUrl!;
        const atlasJsonSignal = this.#atlasJson!;
        const overrideImageUrlSignal = this.#overrideImageUrl!;
        const atlasSignal = this.#atlas!;

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
                  // an error response with a JSON body would otherwise pass for an atlas, and
                  // the first read of `meta.image` would throw inside an effect
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
                this.atlasJson = atlasJson;
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
            const imageCoords = this.imageCoords;
            if (atlasJson && imageCoords) {
              // an atlas describes the image its json names. While the image effect is still
              // on its way to that image, the atlas of the one before stays published — it is
              // not cleared, because a subscriber would get an `undefined` where the event
              // type promises a TextureAtlas. The run this skips is taken up again as soon as
              // the image arrives: that is what `#imageUrlOfCoords` sits in the dependencies
              // for
              if (this.#imageUrlOfCoords.value !== (this.overrideImageUrl ?? atlasJson.meta.image)) return;
              const [atlas] = TexturePackerJson.parse(atlasJson, imageCoords);
              atlasSignal.set(atlas);
            }
          },
          [atlasJsonSignal, this.#imageCoords, this.#imageUrlOfCoords],
          {attach: this, priority: DERIVED_FROM_IMAGE_PRIORITY},
        );

        createEffect(
          () => {
            const atlas = this.atlas;
            if (atlas && this.frameBasedAnimationsData) {
              const animations = new FrameBasedAnimations();
              for (const [name, data] of Object.entries(this.frameBasedAnimationsData)) {
                if ('frameNameQuery' in data) {
                  const timing = getTimingOptions(data);
                  animations.add(name, timing, atlas, data.frameNameQuery);
                } else {
                  emit(this, OnError, wrongAnimationDataError(this, name, animationDataShape(data)));
                }
              }
              this.#frameBasedAnimations.set(animations);
            }
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
