import type {WebGPURenderer} from 'three/webgpu';
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearSRGBColorSpace,
  MirroredRepeatWrapping,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type ColorSpace,
  type TextureFilter,
  type Wrapping,
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
   *
   * - A factory built with a renderer asks it at every `getOptions()`, `create()` and `update()`,
   *   and when a texture of `load()` or `loadAsync()` arrives, and caps against the maximum the
   *   renderer names at that moment.
   * - While the renderer names none — a WebGL backend before `init()` — the texture gets no
   *   anisotropic filtering.
   * - A texture keeps what it was built with.
   */
  anisotropy: number;
  flipY: boolean;
  /**
   * Whether three.js builds the mip levels of the texture. No class of the factory's seed writes it: a
   * texture without a mipmap class keeps what it has, `true` for a new one.
   */
  generateMipmaps: boolean;
  colorSpace: ColorSpace;
  /**
   * How the texture is read beyond its edges along its width. No class of the factory's seed writes
   * it: a texture without a wrap class keeps the wrap it has, `ClampToEdgeWrapping` for a new one.
   */
  wrapS: Wrapping;
  /** How the texture is read beyond its edges along its height; written by a wrap class alone, as `wrapS`. */
  wrapT: Wrapping;
}

// The anisotropy classes write a raw value that `getOptions()` caps at the maximum of the
// renderer and counts from 1 as three.js does; 0 is none.
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
  mipmaps: {
    generateMipmaps: true,
  },
  'no-mipmaps': {
    generateMipmaps: false,
  },
  srgb: {
    colorSpace: SRGBColorSpace,
  },
  'linear-srgb': {
    colorSpace: LinearSRGBColorSpace,
  },
  repeat: {
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
  },
  'repeat-s': {
    wrapS: RepeatWrapping,
  },
  'repeat-t': {
    wrapT: RepeatWrapping,
  },
  mirror: {
    wrapS: MirroredRepeatWrapping,
    wrapT: MirroredRepeatWrapping,
  },
  'mirror-s': {
    wrapS: MirroredRepeatWrapping,
  },
  'mirror-t': {
    wrapT: MirroredRepeatWrapping,
  },
  clamp: {
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
  },
  'clamp-s': {
    wrapS: ClampToEdgeWrapping,
  },
  'clamp-t': {
    wrapT: ClampToEdgeWrapping,
  },
};

/**
 * The names of the texture option classes a {@link TextureFactory} understands.
 *
 * The wrap classes `repeat`, `mirror` and `clamp` write `wrapS` and `wrapT` both, their forms
 * with `-s` or `-t` the one axis: `s` runs along the width of the image, `t` along its height.
 *
 * When two classes write the same option, the narrower one has the last word: `mag-linear`
 * beats `linear`, and `clamp-t` beats `repeat`, whoever named them. Between two classes of the same
 * breadth the order in which they were named decides, and the one named last wins.
 *
 * A {@link TextureFactory} lines the classes of each call up behind its own default classes, and a
 * {@link TextureStore} the classes of an item behind its defaults: the later one overrules the one it
 * collides with on equal breadth, and a narrower default keeps the last word against a broader
 * class — a `mag-linear` default stands, even when the call or the item asks for `nearest`.
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

  flipy: 500,
  'no-flipy': 500,

  mipmaps: 500,
  'no-mipmaps': 500,

  srgb: 500,
  'linear-srgb': 500,

  repeat: 1000,
  mirror: 1000,
  clamp: 1000,

  'repeat-s': 500,
  'repeat-t': 500,
  'mirror-s': 500,
  'mirror-t': 500,
  'clamp-s': 500,
  'clamp-t': 500,
};

// a maximum that is not a finite, non-negative number is no maximum: 0 stands for
// "this factory hands out no anisotropic filtering"
const toMaxAnisotropy = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

// the renderer answers out of its backend, and a backend that has not been initialized
// has none to ask — a WebGL fallback backend carries `capabilities: null` until `init()`
// has run. An optional quality hint must not stop a texture from being built.
const readMaxAnisotropy = (renderer: WebGPURenderer): number => {
  try {
    return toMaxAnisotropy(renderer.getMaxAnisotropy?.());
  } catch {
    return 0;
  }
};

export class TextureFactory {
  // Asked at every getOptions() and not kept: a renderer names its maximum out of its backend,
  // a WebGL backend names none before init(), and a WebGPU backend names 16 before init() even
  // where three replaces it with a WebGL backend once init() runs. The renderer answers out of a
  // field, and getOptions() runs once per texture, not per frame
  readonly #maxAnisotropy: () => number;
  // the options the classes are applied on top of, with the raw value of the anisotropy
  // classes under `anisotropy`; getOptions() caps it at the maximum of the renderer and counts
  // it from 1 as three.js does
  readonly #seedOptions: Partial<TextureOptions>;
  // a copy, so an array the caller changes later leaves this factory as it was
  readonly #defaultClassNames: readonly TextureOptionClasses[];

  textureLoader: TextureLoader;

  /**
   * @param maxAnisotropyOrRenderer The anisotropy maximum, or the renderer that names it. A
   *   renderer is asked at every `getOptions()`, `create()` and `update()` and when a texture of
   *   `load()` or `loadAsync()` arrives; the factory caps against the maximum it names at that
   *   moment. While it names none — a WebGL backend before `init()` — the texture gets no
   *   anisotropic filtering, and a texture keeps what it was built with.
   * @param defaultClassNames The texture classes every texture of this factory gets, lined up ahead
   *   of the classes of each call and sorted with them: a class of the call overrules a default of
   *   the same breadth, and a narrower default keeps the last word against a broader class of the
   *   call.
   * @param defaultOptions Options laid over the seed `{anisotropy: 0, flipY: false}`: a key they
   *   leave out or give as `undefined` keeps the value of the seed, and the classes lie over both.
   */
  constructor(
    maxAnisotropyOrRenderer: WebGPURenderer | number = 0,
    defaultClassNames: Array<TextureOptionClasses> = ['nearest'],
    defaultOptions?: Partial<TextureOptions>,
  ) {
    if (typeof maxAnisotropyOrRenderer === 'number') {
      const maxAnisotropy = toMaxAnisotropy(maxAnisotropyOrRenderer);
      this.#maxAnisotropy = () => maxAnisotropy;
    } else {
      const renderer = maxAnisotropyOrRenderer;
      this.#maxAnisotropy = () => readMaxAnisotropy(renderer);
    }
    // every factory starts from this seed; `defaultOptions` are laid over it, and a key they leave out
    // or give as `undefined` keeps the value of the seed
    const given = defaultOptions ?? {};
    const defined = Object.fromEntries(
      Object.entries(given).filter(([, value]) => value !== undefined),
    ) as Partial<TextureOptions>;
    this.#seedOptions = {flipY: false, ...defined, anisotropy: defined.anisotropy ?? 0};
    this.#defaultClassNames = defaultClassNames.slice();
    this.textureLoader = new TextureLoader();
  }

  /**
   * The texture options the given classes add up to, sorted together with the default classes of
   * this factory, on top of its default options.
   * `anisotropy` comes counted as three.js counts it, from 1, as {@link TextureFactory.update}
   * gives it to the texture.
   *
   * A name that is no texture option class is skipped; `TextureStore#parse()` reports such a
   * name when a catalog carries it.
   */
  getOptions(classNames: readonly TextureOptionClasses[]): Partial<TextureOptions> {
    const options = this.#mergeOptions(classNames);
    // the raw value of the classes, capped at the maximum of the renderer; three.js counts 1 as none
    options.anisotropy = Math.max(1, Math.min(options.anisotropy ?? 0, this.#maxAnisotropy()));
    return options;
  }

  // the seed with the default classes and the given classes on top, the anisotropy still raw. The
  // default classes are lined up ahead of the given ones and sorted along with them, not melted into
  // the options beforehand: this is the rule of TextureStore, which joins the defaults and the classes
  // of an item into one list. sort() is stable, so on equal breadth every default stays ahead of every
  // given class and the given class wins, while a narrower default is applied after a broader given
  // class and keeps the last word
  #mergeOptions(classNames: readonly TextureOptionClasses[]): Partial<TextureOptions> {
    return Object.assign(
      {},
      this.#seedOptions,
      ...[...this.#defaultClassNames, ...classNames]
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
    // `anisotropy` stays out of the assignment and is set once below
    delete textureOptions.anisotropy;
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
