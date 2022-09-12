import '@react-three/fiber';
import {TextureAtlasData, TextureAtlasLoader, TextureAtlasLoadOptions} from '@spearwolf/vertex-objects';
import {ForwardedRef, forwardRef, ReactNode, useContext, useState} from 'react';
import {AssetStoreContext} from '../context/AssetStore';
import {useAsyncEffect} from '../hooks/useAsyncEffect';
import {TextureOptionsAsProps, toTextureClasses, useTextureBitsFromProps} from '../hooks/useTextureBitsFromProps';

export type TextureAtlasProps = TextureOptionsAsProps &
  TextureAtlasLoadOptions & {
    children?: ReactNode;
    name: string | symbol;
    url: string;
  };

function Component({name, url, overrideImageUrl, children, ...props}: TextureAtlasProps, ref: ForwardedRef<TextureAtlasData>) {
  const assetStore = useContext(AssetStoreContext);
  const [textureAtlas, setTextureAtlas] = useState<TextureAtlasData>();
  const textureBits = useTextureBitsFromProps(props);

  useAsyncEffect(
    async () =>
      url
        ? new TextureAtlasLoader().loadAsync(url, toTextureClasses(textureBits), {
            overrideImageUrl,
          })
        : undefined,
    {
      next(data) {
        assetStore.insertAsset(name, 'atlas', data);
        setTextureAtlas(data);
      },
      cancel(data) {
        // eslint-disable-next-line no-console
        console.log('<TextureAtlas> cancel texture-atlas', data);
        data.texture?.dispose();
      },
      dispose(data) {
        // eslint-disable-next-line no-console
        console.log('<TextureAtlas> dispose texture-atlas', data);
        data.texture?.dispose();
      },
    },
    [url, overrideImageUrl, textureBits],
  );

  return textureAtlas ? (
    <primitive object={textureAtlas} ref={ref} {...props}>
      {children}
    </primitive>
  ) : null;
}

Component.displayName = 'TextureAtlas';

export const TextureAtlas = forwardRef<TextureAtlasData, TextureAtlasProps>(Component);
