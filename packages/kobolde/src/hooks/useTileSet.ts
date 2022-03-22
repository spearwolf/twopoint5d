import {TileSetData, TileSetLoader} from '@spearwolf/vertex-objects';
import {useState} from 'react';
import {useAsyncEffect} from './useAsyncEffect';

export interface UseTileSetParams {
  tileWidth?: number;
  tileHeight?: number;
  margin?: number;
  spacing?: number;
  padding?: number;
  tileCount?: number;
}

export const useTileSet = (tileSetUrl: string, options?: UseTileSetParams): Partial<TileSetData> => {
  const [tileSetData, setTileSetData] = useState<Partial<TileSetData>>({});

  const tileWidth = options?.tileWidth;
  const tileHeight = options?.tileHeight;
  const margin = options?.margin;
  const spacing = options?.spacing;
  const padding = options?.padding;
  const tileCount = options?.tileCount;

  useAsyncEffect(async () => {
    if (tileSetUrl && tileWidth > 0 && tileHeight > 0) {
      // TODO handle updates on margin,spacing,... ?
      const data = await new TileSetLoader().loadAsync(tileSetUrl, {
        tileWidth,
        tileHeight,
        margin,
        spacing,
        padding,
        tileCount,
      });
      setTileSetData(data);
      // TODO dispose?!
    }
  }, [tileSetUrl, tileWidth, tileHeight, margin, spacing, padding, tileCount]);

  return tileSetData;
};
