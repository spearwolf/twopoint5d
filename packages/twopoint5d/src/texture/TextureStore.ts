import {emit, off, on, once, onceAsync, retain} from '@spearwolf/eventize';
import {batch, createSignal, SignalGroup} from '@spearwolf/signalize';
import type {WebGPURenderer} from 'three/webgpu';
import type {TextureOptionClasses} from './TextureFactory.js';
import {TextureResource, type TextureResourceSubType} from './TextureResource.js';
import type {TextureStoreData} from './types.js';

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
    fetch(url).then(async (response) => {
      const data: TextureStoreData = await response.json();
      this.parse(data);
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
            // TODO maybe we can throw away the old resource and create a new one?
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
            // TODO maybe we can throw away the old resource and create a new one?
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

  get(id: string, type: TextureResourceSubType | TextureResourceSubType[], callback: (val: any) => void): () => void {
    const isMultipleTypes = Array.isArray(type);
    const values = isMultipleTypes ? new Map<TextureResourceSubType, any>() : undefined;

    const unsubscribeFromSubType: (() => void)[] = [];
    let unsubscribeFromResource: undefined | (() => void);

    let isActiveSubscription = true;

    const clearSubTypeSubscriptions = () => {
      unsubscribeFromSubType.forEach((cb) => cb());
      unsubscribeFromSubType.length = 0;
    };

    const unsubscribe: () => void = () => {
      isActiveSubscription = false;
      values.clear();
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
                    callback(valuesArg);
                  }
                }),
              );
            });
          } else {
            unsubscribeFromSubType.push(
              on(resource, type, (val) => {
                callback(val);
              }),
            );
          }
        });
      }
    });

    return unsubscribe;
  }

  getOnce(id: string, type: TextureResourceSubType | TextureResourceSubType[]): Promise<any> {
    return new Promise((resolve) => {
      const unsubscribe = this.get(id, type, (...args) => {
        resolve(...args);
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
