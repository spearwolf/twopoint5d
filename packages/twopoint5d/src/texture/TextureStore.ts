import {emit, on, once, onceAsync, retain} from '@spearwolf/eventize';
import {batch, createSignal} from '@spearwolf/signalize';
import type {DisplayRendererType} from '../display/types.js';
import type {TextureOptionClasses} from './TextureFactory.js';
import {TextureResource, type TextureResourceSubType} from './TextureResource.js';
import type {TileSetOptions} from './TileSet.js';

export interface TextureStoreItem {
  imageUrl?: string;
  overrideImageUrl?: string;
  atlasUrl?: string;
  tileSet?: TileSetOptions;
  texture?: TextureOptionClasses[];
}

export interface TextureStoreData {
  defaultTextureClasses: TextureOptionClasses[];
  items: Record<string, TextureStoreItem>;
}

const OnReady = 'ready';
const OnRendererChanged = 'rendererChanged';
const OnResource = 'resource';

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

  #renderer = createSignal<DisplayRendererType | undefined>();

  get renderer(): DisplayRendererType | undefined {
    return this.#renderer.value;
  }

  set renderer(value: DisplayRendererType | undefined) {
    this.#renderer.set(value);
  }

  #resources = new Map<string, TextureResource>();

  constructor() {
    retain(this, [OnReady, OnRendererChanged]);

    this.#renderer.onChange((renderer) => {
      emit(this, OnRendererChanged, renderer);
    });
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
          resource = TextureResource.fromTileSet(id, item.imageUrl, item.tileSet, textureClasses);
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
        // TODO on delete resource: off(resource)
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
}
