import type {Node} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import type {VertexAttributesType} from '../vertex-objects/types.js';
import type {SpriteBase} from './SpriteBase.js';

/** What the frame slot answers. Where no feature fills the slot, the material uses the defaults named here. */
export interface SpriteFrameNodes {
  /** `vec4(s, t, u, v)`: the lookup reads `(s + uv.x · u, t + uv.y · v)`. Default `vec4(0, 0, 1, 1)`, the whole texture. */
  readonly texCoords: Node<'vec4'>;
  /** Above 0.5 swaps the two components of the lookup — a frame with `TextureCoords.FLIP_DIAGONAL`. Default: no swap. */
  readonly flipDiagonal?: Node<'float'>;
  /** `[left, top, right, bottom]`, the margins a packer cut off, as fractions of the untrimmed sprite. Default: no shift. */
  readonly trim?: Node<'vec4'>;
  /**
   * `vec2(x, y)`: 1 along an axis a frame stage mirrored the drawn image on, 0 along one it did not —
   * `Flip` writes it. A stage that places something on the image — an anchor, a nine-slice border —
   * mirrors it along. Default: no mirror.
   */
  readonly mirror?: Node<'vec2'>;
}

/**
 * What the frame slot and a frame stage read through; the other stages get
 * {@link SpriteShaderContext}, which adds the frame and the uv.
 */
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
  /**
   * The measures, in texels, of a texture any feature of the material declares — the calling
   * feature's own or another's. For a set texture it is the size of the texture the shader binds,
   * read on the gpu: it follows an image that arrives or changes after the texture was set, and a
   * texture of the same kind swapped in without a rebuild. For a texture declared with `needsImage`
   * it is a uniform the material keeps current, re-read by `touchTexture(name)`. A texture of another
   * feature that is unset answers `(0, 0)`, and the stage does not wait for it; setting it builds the
   * graph anew.
   */
  textureSize(name: string): Node<'vec2'>;
  /**
   * The `colorSpace` of a texture any feature of the material declares, as it is set — `undefined`
   * while it is unset, and for a texture declared with `needsImage` until its image has measures. A
   * tracked read of its shape, which `textureShapeKey()` carries the colour space in: a texture in
   * another colour space builds the graph anew. The material throws, naming the feature, for a name
   * no feature declares.
   */
  colorSpace(name: string): string | undefined;
}

export interface SpriteShaderContext extends SpriteFrameContext {
  /**
   * The frame of the sprite after every frame stage, built once per graph generation and read by
   * the vertex and the fragment pipeline.
   */
  readonly frame: SpriteFrameNodes;
  /**
   * The uv the color source samples at: the base `uv` after every uv stage — `(0, 0)` the top left
   * of the frame as drawn, `(1, 1)` its bottom right. Built once per graph, the first time a stage
   * reads it; a graph that never reads it builds no uv stage. In a uv stage it is the uv so far, the
   * stage's own input. `attribute('uv')` stays the base uv, where the vertex lies on the base.
   *
   * It is evaluated where its reader uses it: a color source that hands it to `frameUv()`, as
   * `TextureColor` does, works it out per vertex and interpolates it across each triangle; one that
   * reads it in its own fragment graph works it out per fragment.
   */
  readonly uv: Node<'vec2'>;
}

export interface SpriteStage<T extends string> {
  /** Where in its slot this stage runs; lower runs first, a tie keeps the order of the feature list. */
  readonly order: number;
  transform(input: Node<T>, ctx: SpriteShaderContext): Node<T>;
}

/** A stage on the frame: after the frame slot, before the trim shift and both pipelines read the frame. */
export interface SpriteFrameStage {
  /** Where among the frame stages this one runs; lower runs first, a tie keeps the order of the feature list. */
  readonly order: number;
  /** Answers the whole frame; a stage with no business with `flipDiagonal` or `trim` passes them on. */
  transform(frame: SpriteFrameNodes, ctx: SpriteFrameContext): SpriteFrameNodes;
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
 * A uniform declared with options. `shared: true` lets several features declare the same name: the
 * features that declare it shared hold one uniform, as long as they declare it with the same type
 * and start value. Without it a second feature that declares the name is refused.
 */
export interface SpriteUniformDeclaration {
  readonly value: SpriteUniformValue;
  /** Whether other features may declare the same uniform, shared as well. Default `false`. */
  readonly shared?: boolean;
}

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
  /**
   * Uniforms the material holds for this feature, with their start values — or, as `{value, shared:
   * true}`, a uniform other features may declare as well, shared alike.
   */
  readonly uniforms?: Readonly<Record<string, SpriteUniformValue | SpriteUniformDeclaration>>;
  /** Textures the material holds for this feature. They stay the caller's. */
  readonly textures?: Readonly<Record<string, SpriteTextureDeclaration>>;
  /**
   * Textures, by name — the feature's own or another feature's — the feature reads texel for texel. The
   * sprites say once on the console when such a texture is set, with an image, filtered with anything but
   * `NearestFilter` for `magFilter` or `minFilter`; a texture whose image arrives later is judged when
   * `touchTexture()` re-reads it. A name no feature of the sprites declares is passed over.
   */
  readonly nearestTextures?: readonly string[];
  /** The frame slot: at most one feature of a kind. */
  readonly frame?: (ctx: SpriteFrameContext) => SpriteFrameNodes;
  /** A stage on the frame, after the frame slot and before the trim shift and both pipelines read it. */
  readonly frameStage?: SpriteFrameStage;
  /** A stage in the local quad space, after the trim shift and before the placement. */
  readonly local?: SpriteStage<'vec3'>;
  /** Maps the local vertex into the local space of the mesh: exactly one feature of a kind. */
  readonly placement?: (local: Node<'vec3'>, ctx: SpriteShaderContext) => Node<'vec3'>;
  /** A stage after the placement, in the local space of the mesh — the slot of shadows and mirrors. */
  readonly mesh?: SpriteStage<'vec3'>;
  /**
   * A stage on the uv the color source samples at — `ctx.uv` — before any stage reads it. It is
   * evaluated where the color source uses the uv: `TextureColor` hands it to `frameUv()`, per vertex,
   * so under it a uv stage must be affine within each triangle; a color source that does not use
   * `frameUv()` evaluates it per fragment.
   */
  readonly uv?: SpriteStage<'vec2'>;
  /** The color before the color stages: at most one feature of a kind; without one the sprite is flat grey. */
  readonly colorSource?: (frame: SpriteFrameNodes, ctx: SpriteShaderContext) => Node<'vec4'>;
  /** A stage on the color, after the color source. */
  readonly color?: SpriteStage<'vec4'>;
  /** Other features, by name, that have to be part of the same sprite kind. */
  readonly requires?: readonly string[];
  /**
   * Checks the kind the feature is part of: once when `defineSprite()` merges it, after every check
   * of its own; when a pass that brings the feature is folded into a kind, with the features the pass
   * draws with; and when the feature, a placement, stands in for another on a live material. Throws
   * for a kind the feature cannot work in, with a message that names the fix — the caller adds the
   * name of the feature. When a second feature of its name is listed, `defineSprite()` asks it before
   * every other check, so that the forms of one factory can say why a kind takes only one of them.
   */
  readonly checkKind?: (kind: SpriteKindShape) => void;
  /** Carries `Api` for the type of the sprite handle; never set at runtime. */
  readonly __api?: Api;
}

/** What {@link SpriteFeature.checkKind} is shown of a kind: its base and its features. */
export interface SpriteKindShape {
  readonly base: SpriteBase;
  readonly features: readonly SpriteFeature[];
}

const STAGE_SLOTS = ['frameStage', 'local', 'mesh', 'uv', 'color'] as const;

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
        `defineFeature: the ${slot} stage of feature "${feature.name}" needs a finite order, got ${describeValue(stage.order)}`,
      );
    }
  }
  if (feature.checkKind != null && typeof feature.checkKind !== 'function') {
    throw new TypeError(`defineFeature: the checkKind of feature "${feature.name}" is no function`);
  }
  if (
    feature.nearestTextures != null &&
    !(Array.isArray(feature.nearestTextures) && feature.nearestTextures.every((name) => typeof name === 'string'))
  ) {
    throw new TypeError(`defineFeature: the nearestTextures of feature "${feature.name}" is no list of texture names`);
  }
  if (feature.requires?.includes(feature.name)) {
    throw new TypeError(`defineFeature: feature "${feature.name}" requires itself`);
  }
  return Object.freeze({...feature});
}

/**
 * The order bands of the local stages; the gaps take stages of your own. `Slice` moves the inner grid
 * lines of a nine-slice, in the unit quad before `Scale`.
 */
export const LocalOrder = Object.freeze({Anchor: 100, Flip: 150, Slice: 175, Scale: 200, Shear: 300, Rotate: 400} as const);

/**
 * The order bands of the frame stages. `Flip` mirrors the frame — `LocalOrder.Flip` is for a stage
 * of one's own that mirrors the geometry itself, which turns its triangles over.
 */
export const FrameOrder = Object.freeze({Flip: 100} as const);

/** The order bands of the uv stages. `Slice` moves the inner grid lines of a nine-slice. */
export const UvOrder = Object.freeze({Slice: 100} as const);

/** The order bands of the mesh stages. */
export const MeshOrder = Object.freeze({Offset: 100, Project: 200, Mirror: 300} as const);

/**
 * The order bands of the color stages. `Palette` swaps the colours of the color source before every
 * other stage acts on them. `Pass` is the band of the color stages a pass brings to recolor the sprite as
 * a whole — `ShadowMask`, `Darken` — after every color stage of the kind.
 */
export const ColorOrder = Object.freeze({Palette: 50, Tint: 100, Mask: 150, Fade: 200, Flash: 300, Pass: 1000} as const);
