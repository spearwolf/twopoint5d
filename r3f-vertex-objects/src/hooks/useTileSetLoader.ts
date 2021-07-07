import {
  TextureFactory,
  TileSetLoader,
  TileSetOptions,
} from 'three-vertex-objects';
import {useAsset} from 'use-asset';

export function useTileSetLoader(
  url: string,
  options: TileSetOptions,
  textureFactory?: TextureFactory,
) {
  return useAsset(
    ([url, options]: [string, TileSetOptions]) => {
      const tilesetLoader = new TileSetLoader(
        textureFactory ?? new TextureFactory(),
      );
      return tilesetLoader.loadAsync(url, options);
    },
    [url, options],
  );
}
