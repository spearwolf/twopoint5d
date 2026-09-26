import {TextureStore} from '@spearwolf/twopoint5d';
import type {WebGPURenderer} from 'three/webgpu';
import assetsUrl from './assetsUrl.js';

/**
 * A store with the catalog of the lookbook, `public/assets/textures.json`, which names the image,
 * tile set and texture classes of each item. The store belongs to the caller, who disposes it; a
 * load that fails disposes the store it built before the error reaches the caller.
 */
export async function loadTextureCatalog(renderer: WebGPURenderer): Promise<TextureStore> {
  const store = new TextureStore(renderer);
  try {
    await store.loadAsync(assetsUrl('textures.json'));
  } catch (error) {
    store.dispose();
    throw error;
  }
  return store;
}
