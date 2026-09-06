import type {WebGPURenderer} from 'three/webgpu';
import {
  LinearFilter,
  LinearSRGBColorSpace,
  NearestFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type ColorSpace,
  type TextureFilter,
} from 'three/webgpu';

import type {TextureSource} from './types.js';

export interface TextureOptions {
  magFilter: TextureFilter;
  minFilter: TextureFilter;
  anisotrophy: number;
  flipY: boolean;
  colorSpace: ColorSpace;
}

const TextureClasses = {
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

/**
 * The names of the texture option classes a {@link TextureFactory} understands.
 *
 * When two classes write the same option, the narrower one has the last word: `mag-linear`
 * beats `linear`, whoever named them. Between two classes of the same breadth the order in
 * which they were named decides, and the one named last wins.
 *
 * A {@link TextureStore} lines the classes of an item up behind its own defaults, so an item
 * overrules the store default it collides with on equal breadth. A narrower default keeps the
 * last word against a broader item class: a `mag-linear` default stands, even when the item
 * asks for `nearest`.
 */
export type TextureOptionClasses = keyof typeof TextureClasses;

// The number says how broad a class is, not how important: a class that writes two
// options is applied before one that writes a single one, so the narrower class has
// the last word. Classes of the same breadth carry the same number — then the order
// in which they were named decides, and the one named last wins.
const TextureClassPriority: Record<TextureOptionClasses, number> = {
  nearest: 1000,
  linear: 1000,

  'mag-nearest': 500,
  'min-nearest': 500,
  'mag-linear': 500,
  'min-linear': 500,

  anisotrophy: 500,
  'anisotrophy-2': 500,
  'anisotrophy-4': 500,
  'no-anisotrophy': 500,

  flipy: 500,
  'no-flipy': 500,

  srgb: 500,
  'linear-srgb': 500,
};

// a maximum that is not a finite, non-negative number is no maximum: 0 stands for
// "this factory hands out no anisotropic filtering"
const toMaxAnisotrophy = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

// the renderer answers out of its backend, and a backend that has not been initialized
// has none to ask — a WebGL fallback backend carries `capabilities: null` until `init()`
// has run. An optional quality hint must not stop a factory from being built.
const readMaxAnisotrophy = (renderer: WebGPURenderer): number => {
  try {
    return toMaxAnisotrophy(renderer.getMaxAnisotropy?.());
  } catch {
    return 0;
  }
};

export class TextureFactory {
  #maxAnisotrophy = 0;
  #defaultOptions: Partial<TextureOptions>;

  textureLoader: TextureLoader;

  constructor(
    maxAnisotrophyOrRenderer: WebGPURenderer | number = 0,
    defaultClassNames: Array<TextureOptionClasses> = ['nearest'],
    defaultOptions?: Partial<TextureOptions>,
  ) {
    this.#maxAnisotrophy =
      typeof maxAnisotrophyOrRenderer === 'number'
        ? toMaxAnisotrophy(maxAnisotrophyOrRenderer)
        : readMaxAnisotrophy(maxAnisotrophyOrRenderer);
    this.#defaultOptions = defaultOptions ?? {
      anisotrophy: 0,
      flipY: false,
    };
    // resolve defaults against the supplied class names; the seed assignment
    // above acts as the "no classes" fallback inside getOptions().
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
    options.anisotrophy = Math.min(options.anisotrophy ?? 0, this.#maxAnisotrophy);
    return options;
  }

  create(source: TextureSource, ...classNames: Array<TextureOptionClasses>): Texture {
    const texture = new Texture(source);
    return this.update(texture, ...classNames);
  }

  update(texture: Texture, ...classNames: Array<TextureOptionClasses>): Texture {
    const {anisotrophy, ...textureOptions} = this.getOptions(classNames);
    Object.assign(texture, textureOptions);
    // three.js counts anisotropy from 1 (= no anisotropic filtering) and validates the
    // value when it builds the sampler; the option scale of this factory counts from 0
    texture.anisotropy = Math.max(1, anisotrophy ?? 0);
    texture.needsUpdate = true;
    return texture;
  }

  load(url: string, ...classNames: Array<TextureOptionClasses>): Texture {
    return this.textureLoader.load(url, (texture) => {
      this.update(texture, ...classNames);
    });
  }
}
