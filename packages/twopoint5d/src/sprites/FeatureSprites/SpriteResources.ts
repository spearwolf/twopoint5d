import {
  createEffect,
  createMemo,
  createSignal,
  type Effect,
  type Signal,
  SignalGroup,
  type SignalReader,
} from '@spearwolf/signalize';
import {uniform} from 'three/tsl';
import {type Texture, type UniformNode, Vector2, Vector3, Vector4} from 'three/webgpu';
import {textureShapeKey} from '../textureShapeKey.js';
import {collectSpriteDeclarations} from '../spriteDeclarations.js';
import type {SpriteFeature, SpriteUniformValue} from '../SpriteFeature.js';

export type SpriteUniformNode =
  | UniformNode<'float', number>
  | UniformNode<'vec2', Vector2>
  | UniformNode<'vec3', Vector3>
  | UniformNode<'vec4', Vector4>;

export interface SpriteResourcesOptions {
  /** The textures to start with, by declared name. They stay the caller's. */
  textures?: Readonly<Record<string, Texture | undefined>>;
  /** Start values that replace the declared ones, by declared name. */
  uniforms?: Readonly<Record<string, SpriteUniformValue | undefined>>;
}

type ImageLike = {width?: number; height?: number} | null | undefined;

// the measures of the image of a texture, while it has one: a texture whose image has not loaded yet carries none
const loadedImageOf = (texture: Texture | undefined): {width: number; height: number} | undefined => {
  const image = texture?.image as ImageLike;
  const width = image?.width;
  const height = image?.height;
  return width != null && width > 0 && height != null && height > 0 ? {width, height} : undefined;
};

const VECTOR_TYPES = ['float', 'vec2', 'vec3', 'vec4'] as const;
const sizeOfValue = (value: SpriteUniformValue): number => (typeof value === 'number' ? 1 : value.length);

const makeUniform = (value: SpriteUniformValue): SpriteUniformNode => {
  if (typeof value === 'number') return uniform(value) as SpriteUniformNode;
  switch (value.length) {
    case 2:
      return uniform(new Vector2(...value)) as SpriteUniformNode;
    case 3:
      return uniform(new Vector3(...value)) as SpriteUniformNode;
    default:
      return uniform(new Vector4(...(value as readonly [number, number, number, number]))) as SpriteUniformNode;
  }
};

interface TextureSlot {
  readonly signal: Signal<Texture | undefined>;
  readonly shape: SignalReader<string | undefined>;
  readonly size: UniformNode<'vec2', Vector2>;
  readonly sizeEffect: Effect;
}

/**
 * The uniforms and textures a set of features declares, held once. The material of a
 * `FeatureSprites` and the materials of its passes read the same `SpriteResources`, so one
 * `time` drives the sprites and their shadow, and one `colorMap` is set for all of them.
 *
 * A texture is followed by its shape (`textureShapeKey()`): a texture of the same kind takes the
 * place of the one set without a rebuild of any graph. For a texture declared with `needsImage`,
 * the shape stays `undefined` until the image has measures.
 */
export class SpriteResources {
  readonly uniforms: Readonly<Record<string, SpriteUniformNode>>;
  readonly textureNames: readonly string[];

  readonly #where: string;
  readonly #textures = new Map<string, TextureSlot>();
  readonly #uniformSizes = new Map<string, number>();
  #disposed = false;

  get isDisposed(): boolean {
    return this.#disposed;
  }

  constructor(features: Iterable<SpriteFeature>, options: SpriteResourcesOptions = {}, where = 'SpriteResources') {
    this.#where = where;
    const declarations = collectSpriteDeclarations(features, where);

    const uniforms: Record<string, SpriteUniformNode> = {};
    for (const [name, {value}] of declarations.uniforms) {
      uniforms[name] = makeUniform(value);
      this.#uniformSizes.set(name, sizeOfValue(value));
    }
    this.uniforms = Object.freeze(uniforms);

    for (const [name, value] of Object.entries(options.uniforms ?? {})) {
      if (value === undefined) continue;
      const size = this.#assertUniform(name);
      if (sizeOfValue(value) !== size) throw this.#shapeError(name, size);
      this.setUniform(name, ...((typeof value === 'number' ? [value] : value) as [number, number?, number?, number?]));
    }

    // refused before any signal exists: a constructor that throws leaves nothing behind
    for (const name of Object.keys(options.textures ?? {})) {
      if (!declarations.textures.has(name)) {
        throw new Error(
          `${where}: no feature declares the texture "${name}"; declared: ${[...declarations.textures.keys()].join(', ')}`,
        );
      }
    }

    for (const [name, {needsImage}] of declarations.textures) {
      const signal = createSignal<Texture | undefined>(undefined, {attach: this});
      // what a graph depends on of the texture: its kind, and for needsImage whether it has an image yet
      const shape = createMemo(
        () => {
          const texture = signal.get();
          return needsImage && loadedImageOf(texture) == null ? undefined : textureShapeKey(texture);
        },
        {attach: this},
      );
      const size = uniform(new Vector2(0, 0)) as UniformNode<'vec2', Vector2>;
      // three reads a uniform at run time, so the measures of a new image need no rebuild
      const sizeEffect = createEffect(
        () => {
          const image = loadedImageOf(signal.get());
          size.value.set(image?.width ?? 0, image?.height ?? 0);
        },
        {attach: this},
      );
      this.#textures.set(name, {signal, shape, size, sizeEffect});
    }
    this.textureNames = Object.freeze([...this.#textures.keys()]);

    for (const [name, texture] of Object.entries(options.textures ?? {})) {
      this.setTexture(name, texture);
    }
  }

  #assertUniform(name: string): number {
    const size = this.#uniformSizes.get(name);
    if (size == null) {
      throw new Error(
        `${this.#where}: no feature declares the uniform "${name}"; declared: ${[...this.#uniformSizes.keys()].join(', ')}`,
      );
    }
    return size;
  }

  #shapeError(name: string, size: number): TypeError {
    return new TypeError(
      `${this.#where}: the uniform "${name}" is a ${VECTOR_TYPES[size - 1]} and takes ${size} value${size === 1 ? '' : 's'}`,
    );
  }

  #slot(name: string): TextureSlot {
    const slot = this.#textures.get(name);
    if (slot == null) {
      throw new Error(`${this.#where}: no feature declares the texture "${name}"; declared: ${this.textureNames.join(', ')}`);
    }
    return slot;
  }

  /**
   * The uniform `name`, for a stage; throws in the words of `where` for a name no feature declares.
   * Keeps answering it once disposed: the uniforms outlive `dispose()`.
   */
  uniform(name: string, where: string): SpriteUniformNode {
    const node = this.uniforms[name];
    if (node == null) throw new Error(`${where} reads the uniform "${name}", which no feature of these sprites declares`);
    return node;
  }

  /**
   * Writes a uniform: one number for a `float`, two to four for a `vec2` to `vec4`. Allocates
   * nothing — call it every frame. Keeps working after `dispose()`; it reaches nothing that still renders.
   */
  setUniform(name: string, x: number, y?: number, z?: number, w?: number): void {
    const size = this.#assertUniform(name);
    const given = w !== undefined ? 4 : z !== undefined ? 3 : y !== undefined ? 2 : 1;
    if (given !== size) throw this.#shapeError(name, size);
    const node = this.uniforms[name]!;
    if (size === 1) {
      (node as UniformNode<'float', number>).value = x;
    } else {
      (node.value as Vector4).set(x, y!, z!, w!);
    }
  }

  /** The texture `name`; a tracked read inside an effect. `undefined` once disposed. */
  getTexture(name: string): Texture | undefined {
    return this.#slot(name).signal.get();
  }

  /** The texture `name`, read without tracking; `undefined` once disposed. @internal */
  peekTexture(name: string): Texture | undefined {
    return this.#slot(name).signal.value;
  }

  /**
   * Sets the texture `name`. It stays the caller's; {@link dispose} does not release it. A texture
   * of the same kind as the one set costs no rebuild; another kind, or a change between none and
   * one, rebuilds the graphs that read it. Does nothing once disposed.
   */
  setTexture(name: string, texture: Texture | undefined): void {
    const slot = this.#slot(name);
    if (this.#disposed) return;
    slot.signal.set(texture);
  }

  /**
   * Re-reads the texture `name`. `TextureLoader` writes a loaded image into the same texture
   * without an event; call this once it has loaded. Does nothing once disposed.
   */
  touchTexture(name: string): void {
    const slot = this.#slot(name);
    if (this.#disposed) return;
    slot.signal.touch();
  }

  /**
   * The shape key of the texture `name`; `undefined` while it is unset or, for `needsImage`, has no
   * image, and once disposed. Tracked.
   */
  shapeOf(name: string): string | undefined {
    return this.#slot(name).shape();
  }

  /**
   * The measures of the image of the texture `name`, in texels: a uniform kept current here. Once
   * disposed it keeps answering the same uniform, which keeps the last measures it held.
   */
  textureSize(name: string): UniformNode<'vec2', Vector2> {
    return this.#slot(name).size;
  }

  /** Whether every uniform and texture `feature` declares is held here; answers alike once disposed. */
  declares(feature: SpriteFeature): boolean {
    return (
      Object.keys(feature.uniforms ?? {}).every((name) => this.#uniformSizes.has(name)) &&
      Object.keys(feature.textures ?? {}).every((name) => this.#textures.has(name))
    );
  }

  /**
   * Gives up the textures — they belong to the caller and are not released — and tears down the
   * signals. Afterwards `getTexture()` answers `undefined`, `setTexture()` and `touchTexture()` do
   * nothing; the uniforms stay readable and writable. A second call does nothing.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    // the effects go first: a write below would run them on the spot
    for (const slot of this.#textures.values()) slot.sizeEffect.destroy();
    // given up while the signals are live — a write after SignalGroup.delete() notifies nobody
    for (const slot of this.#textures.values()) slot.signal.set(undefined);
    SignalGroup.delete(this);
  }
}
