import '@react-three/fiber';
import {TileSetLoader, type TileSetData, type TileSetOptions} from '@spearwolf/twopoint5d';
import {forwardRef, useContext, useState, type ForwardedRef, type ReactNode} from 'react';
import {AssetStoreContext} from '../context/AssetStore.js';
import {useAsyncEffect} from '../hooks/useAsyncEffect.js';
import {toTextureClasses, useTextureBitsFromProps, type TextureOptionsAsProps} from '../hooks/useTextureBitsFromProps.js';

export type TileSetProps = TextureOptionsAsProps &
  TileSetOptions & {
    children?: ReactNode;
    name: string | symbol;
    url: string;
  };

function Component({name, url, children, ...props}: TileSetProps, ref: ForwardedRef<TileSetData>) {
  const assetStore = useContext(AssetStoreContext);
  const [tileSet, setTileSet] = useState<TileSetData>();
  const textureBits = useTextureBitsFromProps(props);

  useAsyncEffect(
    async () => (url ? new TileSetLoader().loadAsync(url, props, toTextureClasses(textureBits)) : undefined),
    {
      next(data) {
        assetStore.insertAsset(name, 'tileset', data);
        setTileSet(data);
      },
      cancel(data) {
        console.log('<TileSet> cancel tile-set', data);
        data.texture?.dispose();
      },
      dispose(data) {
        console.log('<TileSet> dispose tile-set', data);
        data.texture?.dispose();
      },
    },
    [url, textureBits],
  );

  return tileSet ? (
    <primitive object={tileSet} ref={ref} {...props}>
      {children}
    </primitive>
  ) : null;
}

Component.displayName = 'TileSet';

export const TileSet = forwardRef<TileSetData, TileSetProps>(Component);
