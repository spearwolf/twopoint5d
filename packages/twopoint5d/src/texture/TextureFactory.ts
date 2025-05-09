import {
  LinearFilter,
  LinearSRGBColorSpace,
  NearestFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  WebGLRenderer,
  type ColorSpace,
  type TextureFilter,
} from 'three';

import type {WebGPURenderer} from 'three/webgpu';
import type {ThreeRendererType} from '../display/types.js';
import type {TextureSource} from './types.js';

export interface TextureOptions {
  magFilter: TextureFilter;
  minFilter: TextureFilter;
  anisotrophy: number;
  flipY: boolean;
  colorSpace: ColorSpace;
  // TODO encoding @see https://threejs.org/docs/#api/en/constants/Textures
}

const TextureClasses = {
  // TODO encoding classes
  anisotrophy: {
    anisotrophy: Infinity,
  },
  'anisotrophy-2': {
    anisotrophy: 2,
  },
  'anisotrophy-4': {
    anisotrophy: 4,
  },
  'no-anisotrophy': {
    anisotrophy: 0,
  },
  nearest: {
    magFilter: NearestFilter,
    minFilter: NearestFilter,
  },
  'mag-nearest': {
    magFilter: NearestFilter,
  },
  'min-nearest': {
    minFilter: NearestFilter,
  },
  linear: {
    magFilter: LinearFilter,
    minFilter: LinearFilter,
  },
  'mag-linear': {
    magFilter: LinearFilter,
  },
  'min-linear': {
    minFilter: LinearFilter,
  },
  flipy: {
    flipY: true,
  },
  'no-flipy': {
    flipY: false,
  },
  srgb: {
    colorSpace: SRGBColorSpace,
  },
  'linear-srgb': {
    colorSpace: LinearSRGBColorSpace,
  },
};

export type TextureOptionClasses = keyof typeof TextureClasses;

const TextureClassPriority: Record<TextureOptionClasses, number> = {
  'no-anisotrophy': 1000,
  'anisotrophy-2': 500,
  'anisotrophy-4': 250,
  anisotrophy: 0,

  nearest: 1000,
  'mag-nearest': 500,
  'min-nearest': 500,

  linear: 1000,
  'mag-linear': 500,
  'min-linear': 500,

  flipy: 10,
  'no-flipy': 0,

  srgb: 0,
  'linear-srgb': 10,
};

export class TextureFactory {
  #maxAnisotrophy = 0;
  #defaultOptions: Partial<TextureOptions>;

  textureLoader: TextureLoader;

  constructor(
    maxAnisotrophyOrRenderer: number | ThreeRendererType = 0,
    defaultClassNames: Array<TextureOptionClasses> = ['nearest'],
    defaultOptions?: Partial<TextureOptions>,
  ) {
    this.#maxAnisotrophy =
      typeof maxAnisotrophyOrRenderer === 'number'
        ? maxAnisotrophyOrRenderer
        : ((maxAnisotrophyOrRenderer as WebGLRenderer).capabilities?.getMaxAnisotropy?.() ??
          (maxAnisotrophyOrRenderer as WebGPURenderer).getMaxAnisotropy?.());
    this.#defaultOptions = defaultOptions ?? {
      anisotrophy: 0,
      flipY: false,
    };
    this.#defaultOptions = this.getOptions(defaultClassNames);
    this.textureLoader = new TextureLoader();
  }

  getOptions(classNames: Array<TextureOptionClasses>): Partial<TextureOptions> {
    const options = Object.assign(
      {},
      this.#defaultOptions,
      ...classNames
        .map((className) => [TextureClassPriority[className], TextureClasses[className]] as [number, Partial<TextureOptions>])
        .sort(([a], [b]) => b - a)
        .map(([, opts]) => opts),
    );
    options.anisotrophy = Math.min(options.anisotrophy, this.#maxAnisotrophy);
    return options;
  }

  create(source: TextureSource, ...classNames: Array<TextureOptionClasses>): Texture {
    const texture = new Texture(source);
    return this.update(texture, ...classNames);
  }

  update(texture: Texture, ...classNames: Array<TextureOptionClasses>): Texture {
    Object.assign(texture, this.getOptions(classNames));
    texture.needsUpdate = true;
    return texture;
  }

  load(url: string, ...classNames: Array<TextureOptionClasses>): Texture {
    return this.textureLoader.load(url, (texture) => {
      this.update(texture, ...classNames);
    });
  }
}
