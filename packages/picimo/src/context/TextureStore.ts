import eventize, {Eventize} from '@spearwolf/eventize';
import {TextureAtlasData, TileSetData} from '@spearwolf/vertex-objects';
import {createContext} from 'react';
import {Texture} from 'three';

export type AssetName = string | symbol;
export type AssetType = 'texture' | 'tileset' | 'atlas';

export type AssetItem = {
  name: AssetName;
  refCount: number;
} & (
  | {
      type: 'texture';
      data: Texture;
    }
  | {
      type: 'tileset';
      data: TileSetData;
    }
  | {
      type: 'atlas';
      data: TextureAtlasData;
    }
);

export const asTexture = (item: AssetItem): Texture | undefined => {
  switch (item.type) {
    case 'texture':
      return item.data;

    case 'tileset':
      return item.data.texture;

    case 'atlas':
      return item.data.texture;
  }
};

export interface TextureStore extends Eventize {}

export class TextureStore {
  readonly #assets = new Map<AssetName, AssetItem>();

  constructor() {
    eventize(this);
  }

  insertAsset(name: AssetName, type: AssetType, data: any) {
    let item: AssetItem = this.#assets.get(name);

    if (item) {
      item.type = type;
      item.data = data;
    } else {
      item = {
        name,
        type,
        data,
        refCount: 0,
      };

      this.#assets.set(name, item);
    }

    console.log('[TextureStore] asset:insert', item);

    this.emit('asset:insert', item.name);
  }

  getTextureRef(name: AssetName): Texture | undefined {
    const item = this.#assets.get(name);
    if (item) {
      item.refCount++;
      console.log('[TextureStore] increase refCount to', item.refCount, 'for asset', item.name);
      return asTexture(item);
    }
    return undefined;
  }

  disposeTextureRef(name: AssetName): void {
    const item = this.#assets.get(name);
    if (item && item.refCount > 0) {
      console.log('[TextureStore] decrease refCount to', item.refCount, 'for asset', item.name);
      if (--item.refCount === 0) {
        asTexture(item)?.dispose();
      }
    }
  }

  dispose() {
    for (const item of this.#assets.values()) {
      asTexture(item)?.dispose();
    }
  }
}

const defaultTextureStore = new TextureStore();

export const TextureStoreContext = createContext(defaultTextureStore);

TextureStoreContext.displayName = 'TextureStore';

export default TextureStoreContext;
