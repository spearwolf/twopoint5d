import {eventize, type Eventize} from '@spearwolf/eventize';
import {batch, createSignal, value, type SignalReader} from '@spearwolf/signalize';
import {type TextureOptionClasses, type TileSetOptions} from '@spearwolf/twopoint5d';
import type {WebGLRenderer} from 'three';
import {TextureResource, type TextureResourceSubType} from './TextureResource.js';

export interface TextureStoreItem {
  imageUrl?: string;
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

export interface TextureStore extends Eventize {}

export class TextureStore {
  static async load(url: string | URL): Promise<TextureStore> {
    return new TextureStore().load(url);
  }

  defaultTextureClasses: TextureOptionClasses[] = [];

  #renderer = createSignal<WebGLRenderer | undefined>();

  get renderer(): WebGLRenderer | undefined {
    return value(this.#renderer[0]);
  }

  get renderer$(): SignalReader<WebGLRenderer | undefined> {
    return this.#renderer[0];
  }

  set renderer(value: WebGLRenderer | undefined) {
    this.#renderer[1](value);
  }

  #resources = new Map<string, TextureResource>();

  constructor() {
    eventize(this);
    this.retain([OnReady, OnRendererChanged]);

    this.renderer$((renderer) => {
      this.emit(OnRendererChanged, renderer);
    });
  }

  onResource(id: string, callback: (resource: TextureResource) => void): () => void {
    const resource = this.#resources.get(id);
    if (resource) {
      callback(resource);
      return () => {};
    }
    return this.on(`${OnResource}:${id}`, (resource) => {
      callback(resource);
    });
  }

  async whenReady(): Promise<TextureStore> {
    await this.onceAsync(OnReady);
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
      }
      // TODO atlasUrl
      else if (item.imageUrl) {
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
        this.on(resource);
        // TODO on delete resource: off(resource)
        updatedResources.push(resource);
      }
    }

    this.emit(OnReady, this);

    updatedResources.forEach((resource) => {
      this.emit(`${OnResource}:${resource.id}`, resource);
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
      unsubscribeFromResource();
      clearSubTypeSubscriptions();
    };

    this.once(OnReady, () => {
      if (isActiveSubscription) {
        unsubscribeFromResource = this.onResource(id, (resource) => {
          clearSubTypeSubscriptions();

          resource.load();
          resource.renderer = this.renderer;

          resource.refCount++;
          unsubscribeFromSubType.push(() => {
            resource.refCount--;
          });

          console.log('resource', resource);

          if (isMultipleTypes) {
            (type as Array<TextureResourceSubType>).forEach((t) => {
              unsubscribeFromSubType.push(
                resource.on(t, (val) => {
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
              resource.on(type, (val) => {
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
