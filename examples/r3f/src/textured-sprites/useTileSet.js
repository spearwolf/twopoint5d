import { TileSetLoader } from "@spearwolf/vertex-objects";
import { useEffect, useState } from "react";

export const useTileSet = (tileSetUrl, options) => {
  const [tileSetData, setTileSetData] = useState({});

  const tileWidth = options?.tileWidth;
  const tileHeight = options?.tileHeight;
  const margin = options?.margin;
  const spacing = options?.spacing;
  const padding = options?.padding;
  const tileCount = options?.tileCount;

  useEffect(async () => {
    if (tileSetUrl && tileWidth > 0 && tileHeight > 0) {
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
