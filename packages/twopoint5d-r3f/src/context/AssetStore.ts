import {eventize, Eventize} from '@spearwolf/eventize';
import {TextureAtlas, TextureAtlasData, TileSet, TileSetData} from '@spearwolf/twopoint5d';
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

const asTexture = (item: AssetItem): Texture | undefined => {
  switch (item.type) {
    case 'texture':
      return item.data;

    case 'tileset':
      return item.data.texture;

    case 'atlas':
      return item.data.texture;
  }
};

const asTextureAtlas = (item: AssetItem): TextureAtlas | undefined => {
  switch (item.type) {
    case 'tileset':
      return item.data.tileSet.atlas;

    case 'atlas':
      return item.data.atlas;

    default:
      return undefined;
  }
};

const asTileSet = (item: AssetItem): TileSet | undefined => {
  switch (item.type) {
    case 'tileset':
      return item.data.tileSet;

    default:
      return undefined;
  }
};

export interface AssetStore extends Eventize {}

export class AssetStore {
  static AssetInsertEvent = 'asset:insert';

  readonly #assets = new Map<AssetName, AssetItem>();

  constructor() {
    eventize(this);
  }

  insertAsset(name: AssetName, type: AssetType, data: any) {
    let item: AssetItem | undefined = this.#assets.get(name);

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

      this.#assets.set(name, item!);
    }

    // eslint-disable-next-line no-console
    console.log('[AssetStore]', AssetStore.AssetInsertEvent, item);

    this.emit(AssetStore.AssetInsertEvent, item!.name);
  }

  onAssetInsert(assetName: AssetName, callback: (assetName: AssetName, assetStore: AssetStore) => void): () => void {
    return this.on(AssetStore.AssetInsertEvent, (name: AssetName) => {
      if (assetName === name) {
        callback(assetName, this);
      }
    });
  }

  getTextureRef(name: AssetName): Texture | undefined {
    const item = this.#assets.get(name);
    return item ? asTexture(item) : undefined;
  }

  incTextureRefCount(name: AssetName): number {
    const item = this.#assets.get(name);
    if (item) {
      item.refCount++;
      // eslint-disable-next-line no-console
      console.log('[AssetStore] increase refCount to', item.refCount, 'for asset', item.name);
      return item.refCount;
    }
    return -1;
  }

  getTextureAtlas(name: AssetName): TextureAtlas | undefined {
    const item = this.#assets.get(name);
    return item ? asTextureAtlas(item) : undefined;
  }

  getTileSet(name: AssetName): TileSet | undefined {
    const item = this.#assets.get(name);
    return item ? asTileSet(item) : undefined;
  }

  disposeTextureRef(name: AssetName): void {
    const item = this.#assets.get(name);
    if (item && item.refCount > 0) {
      // eslint-disable-next-line no-console
      console.log('[AssetStore] decrease refCount to', item.refCount, 'for asset', item.name);
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

const defaultAssetStore = new AssetStore();

export const AssetStoreContext = createContext(defaultAssetStore);

AssetStoreContext.displayName = 'AssetStore';

export default AssetStoreContext;
