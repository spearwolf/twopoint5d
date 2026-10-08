import type {Node} from 'three/webgpu';
import type {VertexAttributesType} from '../vertex-objects/types.js';

/** What the frame slot answers. Where no feature fills the slot, the material uses the defaults named here. */
export interface SpriteFrameNodes {
  /** `vec4(s, t, u, v)`: the lookup reads `(s + uv.x · u, t + uv.y · v)`. Default `vec4(0, 0, 1, 1)`, the whole texture. */
  readonly texCoords: Node<'vec4'>;
  /** Above 0.5 swaps the two components of the lookup — a frame with `TextureCoords.FLIP_DIAGONAL`. Default: no swap. */
  readonly flipDiagonal?: Node<'float'>;
  /** `[left, top, right, bottom]`, the margins a packer cut off, as fractions of the untrimmed sprite. Default: no shift. */
  readonly trim?: Node<'vec4'>;
}

/** What a frame stage reads through; the other stages get {@link SpriteShaderContext}, which adds the frame. */
export interface SpriteFrameContext {
  /**
   * An instance or base attribute of the sprite kind, by the name it has on the geometry. The
   * material throws, naming the feature, for a name the kind does not hold.
   */
  attribute<T extends string>(name: string): Node<T>;
  /** A uniform some feature of the material declares; the material throws for a name none declares. */
  uniform<T extends string>(name: string): Node<T>;
  /**
   * Samples, at `uv`, a texture the calling feature declares itself. The material keeps every node
   * it hands out here and gives it a new texture of the same kind without a rebuild.
   */
  sample(name: string, uv: Node<'vec2'>): Node<'vec4'>;
  /** The measures of the image of a texture the calling feature declares, in texels; kept current by the material. */
  textureSize(name: string): Node<'vec2'>;
}

export interface SpriteShaderContext extends SpriteFrameContext {
  /** The frame of the sprite, built once per graph and read by the vertex and the fragment pipeline. */
  readonly frame: SpriteFrameNodes;
}

export interface SpriteStage<T extends string> {
  /** Where in its slot this stage runs; lower runs first, a tie keeps the order of the feature list. */
  readonly order: number;
  transform(input: Node<T>, ctx: SpriteShaderContext): Node<T>;
}

export interface SpriteTextureDeclaration {
  /**
   * The texture counts as set only once its image has measures, and the stages of the feature wait
   * for it. `touchTexture(name)` re-reads a texture whose image a loader filled in later.
   */
  readonly needsImage?: boolean;
}

/** The start value of a uniform: a number is a `float`, 2 to 4 numbers a `vec2` to `vec4`. */
export type SpriteUniformValue =
  | number
  | readonly [number, number]
  | readonly [number, number, number]
  | readonly [number, number, number, number];

/**
 * A method of the sprite handle. Declared through a method signature so that a feature of a
 * narrower handle still passes for a feature of any handle, which is what lets one kind list them all.
 */
export type SpriteMethod<Api> = {bivarianceHack(this: Api, ...args: never[]): unknown}['bivarianceHack'];

/**
 * One composable part of a sprite kind. See `docs/sprites.md`, "Writing a feature", for the rules
 * of each field; `defineSprite()` checks them across the features of a kind.
 */
export interface SpriteFeature<Api extends object = object> {
  /** Unique within a sprite kind; every error about the feature names it. */
  readonly name: string;
  /** Instance attributes, merged into the one instanced description of the kind. */
  readonly attributes?: VertexAttributesType;
  /** Words a caller of `attributeUsage` may use for attributes of this feature: `{size: ['quadSize']}`. */
  readonly usageAliases?: Readonly<Record<string, readonly string[]>>;
  /** Methods of the sprite handle. */
  readonly methods?: Readonly<Record<string, SpriteMethod<Api>>>;
  /** Writes the neutral values into a slot `createVO()` hands out — slots come back with old data in them. */
  initialize?(this: Api): void;
  /** Uniforms the material holds for this feature, with their start values. */
  readonly uniforms?: Readonly<Record<string, SpriteUniformValue>>;
  /** Textures the material holds for this feature. They stay the caller's. */
  readonly textures?: Readonly<Record<string, SpriteTextureDeclaration>>;
  /** The frame slot: at most one feature of a kind. */
  readonly frame?: (ctx: SpriteFrameContext) => SpriteFrameNodes;
  /** A stage in the local quad space, after the trim shift and before the placement. */
  readonly local?: SpriteStage<'vec3'>;
  /** Maps the local vertex into the local space of the mesh: exactly one feature of a kind. */
  readonly placement?: (local: Node<'vec3'>, ctx: SpriteShaderContext) => Node<'vec3'>;
  /** A stage after the placement, in the local space of the mesh — the slot of shadows and mirrors. */
  readonly mesh?: SpriteStage<'vec3'>;
  /** The color before the color stages: at most one feature of a kind; without one the sprite is flat grey. */
  readonly colorSource?: (frame: SpriteFrameNodes, ctx: SpriteShaderContext) => Node<'vec4'>;
  /** A stage on the color, after the color source. */
  readonly color?: SpriteStage<'vec4'>;
  /** Other features, by name, that have to be part of the same sprite kind. */
  readonly requires?: readonly string[];
  /** Carries `Api` for the type of the sprite handle; never set at runtime. */
  readonly __api?: Api;
}

const STAGE_SLOTS = ['local', 'mesh', 'color'] as const;

/**
 * Checks a feature on its own and freezes it. What can only be checked against the other
 * features of a kind — names, requires, cardinality — `defineSprite()` checks.
 */
export function defineFeature<Api extends object = object>(feature: SpriteFeature<Api>): SpriteFeature<Api> {
  if (typeof feature.name !== 'string' || feature.name === '') {
    throw new TypeError('defineFeature: a feature needs a name');
  }
  for (const slot of STAGE_SLOTS) {
    const stage = feature[slot];
    if (stage != null && !Number.isFinite(stage.order)) {
      throw new TypeError(
        `defineFeature: the ${slot} stage of feature "${feature.name}" needs a finite order, got ${stage.order}`,
      );
    }
  }
  if (feature.requires?.includes(feature.name)) {
    throw new TypeError(`defineFeature: feature "${feature.name}" requires itself`);
  }
  return Object.freeze({...feature});
}

/** The order bands of the local stages; the gaps take stages of your own. */
export const LocalOrder = Object.freeze({Anchor: 100, Flip: 150, Scale: 200, Shear: 300, Rotate: 400} as const);

/** The order bands of the mesh stages. */
export const MeshOrder = Object.freeze({Offset: 100, Project: 200, Mirror: 300} as const);

/** The order bands of the color stages. */
export const ColorOrder = Object.freeze({Tint: 100, Mask: 150, Fade: 200, Flash: 300} as const);
