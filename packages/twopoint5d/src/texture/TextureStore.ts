import {emit, type EventizedObject, off, on, once, onceAsync, retain} from '@spearwolf/eventize';
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
type TextureResourceSubTypeMap = {
  imageCoords: TextureCoords;
  atlas: TextureAtlas;
  tileSet: TileSet;
  texture: Texture;
  frameBasedAnimations: FrameBasedAnimations;
};

/**
 * Helper type to recursively map a tuple of TextureResourceSubType to their corresponding types.
 */
type MapTuple<T extends readonly TextureResourceSubType[]> = T extends readonly [
  infer First extends TextureResourceSubType,
  ...infer Rest extends TextureResourceSubType[],
]
  ? [TextureResourceSubTypeMap[First], ...MapTuple<Rest>]
  : [];

/**
 * Maps an array of TextureResourceSubType to a tuple of their corresponding types.
 * For single types, returns the mapped type directly.
 */
type MapSubTypes<T extends keyof TextureResourceSubTypeMap | readonly (keyof TextureResourceSubTypeMap)[]> =
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

const joinTextureClasses = (...classes: TextureOptionClasses[][] | undefined): TextureOptionClasses[] | undefined => {
  const all = classes?.filter((c) => c != null);
  if (all && all.length) {
    return Array.from(new Set(all.flat()).values());
  }
  return undefined;
};

const cmpDefaultClasses = (a: TextureOptionClasses[] | undefined, b: TextureOptionClasses[] | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

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

  async whenReady(): Promise<TextureStore> {
    await onceAsync(this, OnReady);
    return this;
  }

  /**
   * Resolve once the resource with the given `id` is available (typically after
   * the first `parse()` call). Rejects if the store has fired `OnReady` and the
   * id is still not present — useful to surface configuration mistakes instead
   * of hanging promises.
   */
  async whenResource(id: string): Promise<TextureResource> {
    const existing = this.#resources.get(id);
    if (existing) return existing;
    await onceAsync(this, OnReady);
    const resource = this.#resources.get(id);
    if (!resource) {
      throw new Error(`[TextureStore] No resource with id "${id}" — check your TextureStoreData.items keys.`);
    }
    return resource;
  }

  load(url: string | URL) {
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
        this.parse(data);
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
   */
  parse(data: TextureStoreData) {
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
          batch(() => {
            resource.imageUrl = item.imageUrl;
            resource.tileSetOptions = item.tileSet;
            resource.textureClasses = textureClasses;
            resource.frameBasedAnimationsData = item.frameBasedAnimations;
          });
        } else {
          resource = TextureResource.fromTileSet(id, item.imageUrl, item.tileSet, textureClasses, item.frameBasedAnimations);
        }
      } else if (item.atlasUrl) {
        if (resource) {
          if (resource.type !== 'atlas') {
            throw new Error(`Resource ${id} already exists with type "${resource.type}" - cannot change to "atlas"`);
          }
          batch(() => {
            resource.atlasUrl = item.atlasUrl;
            resource.overrideImageUrl = item.overrideImageUrl;
            resource.textureClasses = textureClasses;
            resource.frameBasedAnimationsData = item.frameBasedAnimations;
          });
        } else {
          resource = TextureResource.fromAtlas(id, item.atlasUrl, item.overrideImageUrl, textureClasses, item.frameBasedAnimations);
        }
      } else if (item.imageUrl) {
        if (resource) {
          if (resource.type !== 'image') {
            throw new Error(`Resource ${id} already exists with type "${resource.type}" - cannot change to "image"`);
          }
          batch(() => {
            resource.imageUrl = item.imageUrl;
            resource.textureClasses = textureClasses;
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
            (type as Array<TextureResourceSubType>).forEach((t) => {
              unsubscribeFromSubType.push(
                on(resource, t, (val) => {
                  values.set(t, val);
                  const valuesArg = (type as Array<TextureResourceSubType>).map((t) => values.get(t)).filter((v) => v != null);
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

  get<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
    id: string,
    type: T,
    options?: {signal?: AbortSignal},
  ): Promise<MapSubTypes<T>> {
    const signal = options?.signal;
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('get() aborted before subscription', 'AbortError'));
        return;
      }
      const unsubscribe = this.on(id, type, (value) => {
        if (signal) signal.removeEventListener('abort', onAbort);
        unsubscribe();
        resolve(value);
      });
      const onAbort = () => {
        unsubscribe();
        reject(new DOMException(`get(${id}, ${String(type)}) aborted`, 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, {once: true});
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

  dispose() {
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
