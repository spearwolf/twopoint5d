import {emit, off, on, once, onceAsync, retain} from '@spearwolf/eventize';
import {batch, createSignal, SignalGroup} from '@spearwolf/signalize';
import type {Texture, WebGPURenderer} from 'three/webgpu';
import type {FrameBasedAnimations} from './FrameBasedAnimations.js';
import type {TextureAtlas} from './TextureAtlas.js';
import type {TextureCoords} from './TextureCoords.js';
import type {TextureOptionClasses} from './TextureFactory.js';
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
 * Maps an array of TextureResourceSubType to an array of their corresponding types.
 * For single types, returns the mapped type directly.
 */
type MapSubTypes<
    T extends
      keyof TextureResourceSubTypeMap
      | readonly (keyof TextureResourceSubTypeMap)[]
  > =
  T extends readonly (keyof TextureResourceSubTypeMap)[]
    ? {[Index in keyof T]: T[Index] extends keyof TextureResourceSubTypeMap ? TextureResourceSubTypeMap[T[Index]] : never}
    : T extends keyof TextureResourceSubTypeMap
      ? TextureResourceSubTypeMap[T]
      : never;

const OnReady = 'ready';
const OnRendererChanged = 'rendererChanged';
const OnResource = 'resource';
const OnDispose = 'dispose';

const joinTextureClasses = (...classes: TextureOptionClasses[][] | undefined): TextureOptionClasses[] | undefined => {
  const all = classes?.filter((c) => c != null);
  if (all && all.length) {
    return Array.from(new Set(all.flat()).values());
  }
  return undefined;
};

export class TextureStore {
  static async load(url: string | URL): Promise<TextureStore> {
    return new TextureStore().load(url);
  }

  defaultTextureClasses: TextureOptionClasses[] = [];

  #renderer = createSignal<WebGPURenderer | undefined>(undefined, {attach: this});

  get renderer(): WebGPURenderer | undefined {
    return this.#renderer.value;
  }

  set renderer(value: WebGPURenderer | undefined) {
    this.#renderer.set(value);
  }

  #resources = new Map<string, TextureResource>();

  constructor(renderer?: WebGPURenderer) {
    retain(this, [OnReady, OnRendererChanged]);

    this.#renderer.onChange((renderer) => {
      emit(this, OnRendererChanged, renderer);
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

  load(url: string | URL) {
    fetch(url)
      .then(async (response) => {
        const data: TextureStoreData = await response.json();
        try {
          this.parse(data);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`[TextureStore] Failed to parse data from ${url}:`, error);
        }
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(`[TextureStore] Failed to load from ${url}:`, error);
      });
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
      this.defaultTextureClasses = data.defaultTextureClasses.splice(0);
    }

    const updatedResources: TextureResource[] = [];

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
          });
        } else {
          resource = TextureResource.fromAtlas(id, item.atlasUrl, item.overrideImageUrl, textureClasses);
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
        this.#resources.set(id, resource);
        on(this, resource);
        updatedResources.push(resource);
      }
    }

    emit(this, OnReady, this);

    updatedResources.forEach((resource) => {
      emit(this, `${OnResource}:${resource.id}`, resource);
    });
  }

  on<T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
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
    };

    once(this, OnDispose, unsubscribe);

    once(this, OnReady, () => {
      if (isActiveSubscription) {
        unsubscribeFromResource = this.onResource(id, (resource) => {
          clearSubTypeSubscriptions();

          resource.load();
          resource.renderer = this.renderer;

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
    });

    return unsubscribe;
  }

  get<T extends TextureResourceSubType | readonly TextureResourceSubType[]>(id: string, type: T): Promise<MapSubTypes<T>> {
    return new Promise((resolve) => {
      const unsubscribe = this.on(id, type, (value) => {
        resolve(value);
        unsubscribe();
      });
    });
  }

  dispose() {
    emit(this, OnDispose);

    this.renderer = undefined;
    SignalGroup.get(this).destroy();

    this.#resources.forEach((resource) => {
      resource.dispose();
    });
    this.#resources.clear();

    off(this);
  }
}
