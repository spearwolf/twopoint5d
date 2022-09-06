import {TextureOptionClasses} from '@spearwolf/vertex-objects';
import {useMemo} from 'react';

export enum TextureBit {
  anisotrophy = 1 << 0,
  anisotrophy2 = 1 << 1,
  anisotrophy4 = 1 << 2,
  noAnisotrophy = 1 << 3,
  nearest = 1 << 4,
  magNearest = 1 << 5,
  minNearest = 1 << 6,
  linear = 1 << 7,
  magLinear = 1 << 8,
  minLinear = 1 << 9,
  flipY = 1 << 10,
  noFlipY = 1 << 11,
}

export type TextureOptionBits = number;

export interface TextureOptionsAsProps {
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
}

export function toTextureClasses(textureBits: TextureOptionBits): TextureOptionClasses[] {
  const classes: TextureOptionClasses[] = [];

  if (textureBits & TextureBit.anisotrophy) {
    classes.push('anisotrophy');
  }
  if (textureBits & TextureBit.anisotrophy2) {
    classes.push('anisotrophy-2');
  }
  if (textureBits & TextureBit.anisotrophy4) {
    classes.push('anisotrophy-4');
  }
  if (textureBits & TextureBit.noAnisotrophy) {
    classes.push('no-anisotrophy');
  }
  if (textureBits & TextureBit.nearest) {
    classes.push('nearest');
  }
  if (textureBits & TextureBit.magNearest) {
    classes.push('mag-nearest');
  }
  if (textureBits & TextureBit.minNearest) {
    classes.push('min-nearest');
  }
  if (textureBits & TextureBit.linear) {
    classes.push('linear');
  }
  if (textureBits & TextureBit.magLinear) {
    classes.push('mag-linear');
  }
  if (textureBits & TextureBit.minLinear) {
    classes.push('min-linear');
  }
  if (textureBits & TextureBit.flipY) {
    classes.push('flipy');
  }
  if (textureBits & TextureBit.noFlipY) {
    classes.push('no-flipy');
  }

  return classes;
}

export function useTextureBitsFromProps({
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
}: TextureOptionsAsProps): TextureOptionBits {
  return useMemo(
    () =>
      [
        anisotrophy ? TextureBit.anisotrophy : 0,
        anisotrophy2 ? TextureBit.anisotrophy2 : 0,
        anisotrophy4 ? TextureBit.anisotrophy4 : 0,
        noAnisotrophy ? TextureBit.noAnisotrophy : 0,
        nearest ? TextureBit.nearest : 0,
        magNearest ? TextureBit.magNearest : 0,
        minNearest ? TextureBit.minNearest : 0,
        linear ? TextureBit.linear : 0,
        magLinear ? TextureBit.magLinear : 0,
        minLinear ? TextureBit.minLinear : 0,
        flipY ? TextureBit.flipY : 0,
        noFlipY ? TextureBit.noFlipY : 0,
      ].reduce((textureBits, bit) => textureBits | bit, 0) as TextureOptionBits,
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
}
