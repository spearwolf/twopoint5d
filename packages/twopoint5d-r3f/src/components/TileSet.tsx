import '@react-three/fiber';
import {TileSetData, TileSetLoader, TileSetOptions} from '@spearwolf/twopoint5d';
import {ForwardedRef, forwardRef, ReactNode, useContext, useState} from 'react';
import {AssetStoreContext} from '../context/AssetStore';
import {useAsyncEffect} from '../hooks/useAsyncEffect';
import {TextureOptionsAsProps, toTextureClasses, useTextureBitsFromProps} from '../hooks/useTextureBitsFromProps';

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
        // eslint-disable-next-line no-console
        console.log('<TileSet> cancel tile-set', data);
        data.texture?.dispose();
      },
      dispose(data) {
        // eslint-disable-next-line no-console
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
