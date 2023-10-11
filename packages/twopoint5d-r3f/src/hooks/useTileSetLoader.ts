import {TileSetLoader, type TileSetData} from '@spearwolf/twopoint5d';
import {useState} from 'react';
import {useAsyncEffect} from './useAsyncEffect.js';

export interface UseTileSetParams {
  tileWidth?: number;
  tileHeight?: number;
  margin?: number;
  spacing?: number;
  padding?: number;
  tileCount?: number;
}

export const useTileSetLoader = (tileSetUrl: string, options?: UseTileSetParams): Partial<TileSetData> => {
  const [tileSetData, setTileSetData] = useState<Partial<TileSetData>>({});

  const tileWidth = options?.tileWidth ?? 0;
  const tileHeight = options?.tileHeight ?? 0;
  const margin = options?.margin;
  const spacing = options?.spacing;
  const padding = options?.padding;
  const tileCount = options?.tileCount;

  useAsyncEffect(
    async () =>
      tileSetUrl && tileWidth > 0 && tileHeight > 0
        ? new TileSetLoader().loadAsync(tileSetUrl, {
            tileWidth,
            tileHeight,
            margin,
            spacing,
            padding,
            tileCount,
          })
        : undefined,
    {
      next(data) {
        setTileSetData(data ?? {});
      },
      cancel(data) {
        console.log('cancel tileset', data);
        data.texture?.dispose();
      },
      dispose(data) {
        console.log('dispose tileset', data);
        data.texture?.dispose();
      },
    },
    [tileSetUrl, tileWidth, tileHeight, margin, spacing, padding, tileCount],
  );

  return tileSetData;
};
