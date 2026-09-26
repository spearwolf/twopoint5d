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

/** How a {@link TextureFactory.load} reports a load that failed. */
export interface TextureLoadOptions {
  onError?: (err: unknown) => void;
}

export interface TextureOptions {
  magFilter: TextureFilter;
  minFilter: TextureFilter;
  /**
   * The anisotropy the texture is given, counted as three.js counts it: 1 is none, a value
   * below 1 counts as 1, and the factory caps it at the maximum of its renderer.
   */
  anisotropy: number;
  /**
   * @deprecated Use {@link TextureOptions.anisotropy}, which counts as three.js does. This one
   *   counts from 0, where 0 is none, and stays until a breaking release removes it.
   */
  anisotrophy?: number;
  flipY: boolean;
  colorSpace: ColorSpace;
}

// The anisotropy classes write a raw value that `getOptions()` turns into both counts: 0 for
// none, anything else capped at the maximum of the renderer. The `anisotrophy` names are
// aliases and write the same values as the names they stand for.
const TextureClasses = {
  anisotropy: {
    anisotropy: Infinity,
  },
  'anisotropy-2': {
    anisotropy: 2,
  },
  'anisotropy-4': {
    anisotropy: 4,
  },
  'no-anisotropy': {
    anisotropy: 0,
  },
  anisotrophy: {
    anisotropy: Infinity,
  },
  'anisotrophy-2': {
    anisotropy: 2,
  },
  'anisotrophy-4': {
    anisotropy: 4,
  },
  'no-anisotrophy': {
    anisotropy: 0,
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
 *
 * `anisotrophy`, `anisotrophy-2`, `anisotrophy-4` and `no-anisotrophy` are deprecated aliases
 * of `anisotropy`, `anisotropy-2`, `anisotropy-4` and `no-anisotropy`, and stay in this union
 * until a breaking release removes them.
 */
export type TextureOptionClasses = keyof typeof TextureClasses;

/**
 * Whether `name` is one of the {@link TextureOptionClasses} — a name a
 * {@link TextureFactory} applies. For names out of json, such as a texture store catalog.
 */
export const isTextureOptionClass = (name: unknown): name is TextureOptionClasses =>
  typeof name === 'string' && Object.hasOwn(TextureClasses, name);

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

  anisotropy: 500,
  'anisotropy-2': 500,
  'anisotropy-4': 500,
  'no-anisotropy': 500,
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
const toMaxAnisotropy = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

// the renderer answers out of its backend, and a backend that has not been initialized
// has none to ask — a WebGL fallback backend carries `capabilities: null` until `init()`
// has run. An optional quality hint must not stop a factory from being built.
const readMaxAnisotropy = (renderer: WebGPURenderer): number => {
  try {
    return toMaxAnisotropy(renderer.getMaxAnisotropy?.());
  } catch {
    return 0;
  }
};

export class TextureFactory {
  #maxAnisotropy = 0;
  // the options the classes are applied on top of, with the raw value of the anisotropy
  // classes under `anisotropy`; getOptions() turns it into the two counts it answers with
  #defaultOptions: Partial<TextureOptions>;

  textureLoader: TextureLoader;

  constructor(
    maxAnisotropyOrRenderer: WebGPURenderer | number = 0,
    defaultClassNames: Array<TextureOptionClasses> = ['nearest'],
    defaultOptions?: Partial<TextureOptions>,
  ) {
    this.#maxAnisotropy =
      typeof maxAnisotropyOrRenderer === 'number'
        ? toMaxAnisotropy(maxAnisotropyOrRenderer)
        : readMaxAnisotropy(maxAnisotropyOrRenderer);
    // the deprecated key stands in for the one it names while that one is missing
    const seedOptions: Partial<TextureOptions> = defaultOptions ?? {anisotropy: 0, flipY: false};
    const {anisotrophy, ...seed} = seedOptions;
    const anisotropy = seed.anisotropy ?? anisotrophy;
    this.#defaultOptions = anisotropy === undefined ? seed : {...seed, anisotropy};
    // resolve defaults against the supplied class names; the seed assignment
    // above acts as the "no classes" fallback inside #mergeOptions().
    this.#defaultOptions = this.#mergeOptions(defaultClassNames);
    this.textureLoader = new TextureLoader();
  }

  /**
   * The texture options the given classes add up to, on top of the defaults of this factory.
   * The anisotropy comes in both counts: `anisotropy` as three.js counts it and as
   * {@link TextureFactory.update} gives it to the texture, the deprecated `anisotrophy` from 0.
   *
   * A name that is no texture option class is skipped; `TextureStore#parse()` reports such a
   * name when a catalog carries it.
   */
  getOptions(classNames: Array<TextureOptionClasses>): Partial<TextureOptions> {
    const options = this.#mergeOptions(classNames);
    // one raw value, two counts: `anisotropy` is what update() gives the texture, and the
    // deprecated `anisotrophy` counts from 0, where 0 is none
    const anisotropy = Math.min(options.anisotropy ?? 0, this.#maxAnisotropy);
    options.anisotropy = Math.max(1, anisotropy);
    options.anisotrophy = anisotropy;
    return options;
  }

  // the defaults of this factory with the given classes on top, the anisotropy still raw
  #mergeOptions(classNames: Array<TextureOptionClasses>): Partial<TextureOptions> {
    return Object.assign(
      {},
      this.#defaultOptions,
      ...classNames
        // a name this factory does not know carries neither options nor a priority, and its
        // `undefined` priority would make the order of every other class undetermined
        .filter(isTextureOptionClass)
        .map((className) => [TextureClassPriority[className], TextureClasses[className]] as [number, Partial<TextureOptions>])
        .sort(([a], [b]) => b - a)
        .map(([, opts]) => opts),
    );
  }

  /**
   * A new texture of `source` with the texture classes applied. A name that is no texture
   * option class is skipped, as {@link TextureFactory.getOptions} does.
   *
   * Every call builds a new texture and keeps no reference to it: the caller owns it and
   * disposes it.
   */
  create(source: TextureSource, ...classNames: Array<TextureOptionClasses>): Texture {
    const texture = new Texture(source);
    return this.update(texture, ...classNames);
  }

  /**
   * Apply the texture classes to `texture` and return it. A name that is no texture option
   * class is skipped, as {@link TextureFactory.getOptions} does.
   */
  update(texture: Texture, ...classNames: Array<TextureOptionClasses>): Texture {
    const textureOptions = this.getOptions(classNames);
    const {anisotropy} = textureOptions;
    // both keys stay out of the assignment: the deprecated one is no field of a texture, and
    // the other is set once below
    delete textureOptions.anisotropy;
    delete textureOptions.anisotrophy;
    Object.assign(texture, textureOptions);
    // three.js counts anisotropy from 1 (= no anisotropic filtering) and validates the
    // value when it builds the sampler; getOptions() answers it counted that way
    texture.anisotropy = anisotropy ?? 1;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * The texture at `url`. It comes back empty and fills itself in once the image is there;
   * the texture classes are applied at that moment.
   *
   * A load that fails reaches the caller only through `options.onError` — pass one, or use
   * {@link TextureFactory.loadAsync}, where the failure cannot be missed.
   *
   * Every call builds a new texture and keeps no reference to it: the caller owns it and
   * disposes it.
   */
  load(url: string, ...classNames: Array<TextureOptionClasses>): Texture;
  load(url: string, options: TextureLoadOptions, ...classNames: Array<TextureOptionClasses>): Texture;
  load(url: string, ...args: [TextureLoadOptions?, ...Array<TextureOptionClasses>] | Array<TextureOptionClasses>): Texture {
    // the two forms are told apart at the first argument: a class name is a string literal,
    // the options are an object. Same trick as `isNamedTextureAtlasArgs` in TextureAtlas
    const hasOptions = typeof args[0] === 'object' && args[0] != null;
    const options = hasOptions ? (args[0] as TextureLoadOptions) : undefined;
    const classNames = (hasOptions ? args.slice(1) : args) as Array<TextureOptionClasses>;

    return this.textureLoader.load(
      url,
      (texture) => {
        this.update(texture, ...classNames);
      },
      // the third parameter of the three.js loader is a progress callback that a texture load
      // never calls — `TextureLoader` hands it to `ImageLoader`, which has no progress to
      // report. There is nothing to offer here, so nothing is promised
      undefined,
      options?.onError,
    );
  }

  /**
   * The texture at `url`, with the texture classes applied once it is there.
   * A load that fails rejects — the error cannot be missed, which is the difference to
   * `load()`, where it has to be asked for through `onError`.
   *
   * Every call builds a new texture and keeps no reference to it: the caller owns it and
   * disposes it.
   */
  loadAsync(url: string, textureClasses?: Array<TextureOptionClasses>): Promise<Texture> {
    return this.textureLoader.loadAsync(url).then((texture) => this.update(texture, ...(textureClasses ?? [])));
  }
}
