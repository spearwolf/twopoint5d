import '@react-three/fiber';
import {TextureAtlasLoader, type TextureAtlasData, type TextureAtlasLoadOptions} from '@spearwolf/twopoint5d';
import {forwardRef, useContext, useState, type ForwardedRef, type ReactNode} from 'react';
import {AssetStoreContext} from '../context/AssetStore.js';
import {useAsyncEffect} from '../hooks/useAsyncEffect.js';
import {toTextureClasses, useTextureBitsFromProps, type TextureOptionsAsProps} from '../hooks/useTextureBitsFromProps.js';

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
        console.log('<TextureAtlas> cancel texture-atlas', data);
        data.texture?.dispose();
      },
      dispose(data) {
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
