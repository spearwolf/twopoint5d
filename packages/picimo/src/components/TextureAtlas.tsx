import '@react-three/fiber';
import {TextureAtlasData, TextureAtlasLoader, TextureAtlasLoadOptions, TextureOptionClasses} from '@spearwolf/vertex-objects';
import {ForwardedRef, forwardRef, ReactNode, useContext, useMemo, useState} from 'react';
import {TextureStoreContext} from '../context/TextureStore';
import {useAsyncEffect} from '../hooks/useAsyncEffect';

export type TextureAtlasProps = {
  children?: ReactNode;
  name: string | symbol;
  url: string;
  anisotrophy?: boolean;
  anisotrophy2?: boolean;
  anisotrophy4?: boolean;
  noAnisotrophy?: boolean;
  nearest?: boolean;
  magNearest?: boolean;
  minNearest?: boolean;
  linear?: boolean;
  magLinear?: boolean;
  minLinear?: boolean;
  flipY?: boolean;
  noFlipY?: boolean;
} & TextureAtlasLoadOptions;

function Component(
  {
    name,
    url,
    overrideImageUrl,
    anisotrophy,
    anisotrophy2,
    anisotrophy4,
    noAnisotrophy,
    nearest,
    magNearest,
    minNearest,
    linear,
    magLinear,
    minLinear,
    flipY,
    noFlipY,
    children,
    ...props
  }: TextureAtlasProps,
  ref: ForwardedRef<TextureAtlasData>,
) {
  const textureStore = useContext(TextureStoreContext);
  const [textureAtlas, setTextureAtlas] = useState<TextureAtlasData>();

  const textureClasses = useMemo(
    () =>
      [
        anisotrophy ? 'anisotrophy' : undefined,
        anisotrophy2 ? 'anisotrophy-2' : undefined,
        anisotrophy4 ? 'anisotrophy-4' : undefined,
        noAnisotrophy ? 'no-anisotrophy' : undefined,
        nearest ? 'nearest' : undefined,
        magNearest ? 'mag-nearest' : undefined,
        minNearest ? 'min-nearest' : undefined,
        linear ? 'linear' : undefined,
        magLinear ? 'mag-linear' : undefined,
        minLinear ? 'min-linear' : undefined,
        flipY ? 'flipy' : undefined,
        noFlipY ? 'no-flipy' : undefined,
      ].filter((textureClass) => textureClass) as TextureOptionClasses[],
    [
      anisotrophy,
      anisotrophy2,
      anisotrophy4,
      noAnisotrophy,
      nearest,
      magNearest,
      minNearest,
      linear,
      magLinear,
      minLinear,
      flipY,
      noFlipY,
    ],
  );

  useAsyncEffect(
    async () =>
      url
        ? new TextureAtlasLoader().loadAsync(url, textureClasses, {
            overrideImageUrl,
          })
        : undefined,
    {
      next(data) {
        textureStore.createAsset(name, 'atlas', data);
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
    [url, overrideImageUrl],
  );

  return textureAtlas ? (
    <primitive object={textureAtlas} ref={ref} {...props}>
      {children}
    </primitive>
  ) : null;
}

Component.displayName = 'TextureAtlas';

export const TextureAtlas = forwardRef<TextureAtlasData, TextureAtlasProps>(Component);
