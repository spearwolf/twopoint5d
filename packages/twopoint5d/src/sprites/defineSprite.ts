import {deepFreeze} from '../utils/deepFreeze.js';
import {describeValue} from '../utils/describeValue.js';
import {isObject} from '../utils/isObject.js';
import {cloneVertexObjectDescription} from '../vertex-objects/cloneVertexObjectDescription.js';
import {voInitialize} from '../vertex-objects/constants.js';
import {sharedVertexObjectDescriptor} from '../vertex-objects/sharedVertexObjectDescriptor.js';
import type {
  VASizeDescription,
  VertexAttributeDescription,
  VertexAttributesType,
  VertexObjectDescription,
  VO,
} from '../vertex-objects/types.js';
import {VertexAttributeDescriptor} from '../vertex-objects/VertexAttributeDescriptor.js';
import {VertexObjectDescriptor} from '../vertex-objects/VertexObjectDescriptor.js';
import {vertexObjectPropertyNames} from '../vertex-objects/vertexObjectPropertyNames.js';
import {checkFeature} from './checkFeature.js';
import type {SpriteBase} from './SpriteBase.js';
import {collectSpriteDeclarations} from './spriteDeclarations.js';
import {runCheckKind} from './runCheckKind.js';
import type {SpriteFeature} from './SpriteFeature.js';
import {buildSpritePipeline, type SpritePipeline} from './spritePipeline.js';

/**
 * A base and the features of a sprite, merged and checked once by {@link defineSprite}. Frozen all
 * the way down — the kind, its feature list, its pipeline and its description with every attribute
 * description in it —; the base and the features stay as their authors left them, and every feature
 * out of `defineFeature()` is frozen as deep.
 */
export interface SpriteKind<Api extends object = object> {
  readonly base: SpriteBase;
  readonly features: readonly SpriteFeature[];
  /**
   * The merged instanced description. One object per kind, so every geometry of the kind built
   * without `attributeUsage` shares one descriptor and one prototype.
   */
  readonly description: VertexObjectDescription;
  /** The `usageAliases` of every feature, for `attributeUsage`. */
  readonly usageAliases: Readonly<Record<string, readonly string[]>>;
  readonly pipeline: SpritePipeline;
  /** Carries the type of the sprite handle; never set at runtime. */
  readonly __api?: Api;
}

/** The handle type of the features `F`: the intersection of their apis. */
export type SpriteApiOf<F extends readonly SpriteFeature[]> = (
  F[number] extends infer U
    ? U extends {readonly __api?: infer A}
      ? (api: NonNullable<A>) => void
      : never
    : never
) extends (api: infer I) => void
  ? I & object
  : never;

/** The sprite handle a pool of kind `K` hands out. */
export type SpriteOf<K> = K extends SpriteKind<infer Api> ? Api & VO : never;

/**
 * The api of kind `K`: the intersection of its feature apis, its sprite handle without the `VO` of a
 * vertex object — the type argument of `FeatureSprites`, `FeatureSpritesGeometry` and
 * `FeatureSpritesMaterial` for that kind.
 */
export type SpriteKindApiOf<K> = K extends SpriteKind<infer Api> ? Api : never;

const WHERE = 'defineSprite';

// every kind defineSprite() hands out. A kind is checked once, there: a copy, or an object of the
// same shape, ran none of those checks
const spriteKinds = new WeakSet<object>();

/**
 * Checks, in the words of `where`, that `kind` came from {@link defineSprite}. @internal
 *
 * @throws a `TypeError` that quotes the value
 */
export function checkSpriteKind(kind: unknown, where: string): asserts kind is SpriteKind {
  if (!spriteKinds.has(kind as object)) {
    throw new TypeError(`${where}: the kind must be a sprite kind from defineSprite(), got ${describeValue(kind)}`);
  }
}

const sizeOf = (attribute: VertexAttributeDescription | undefined): number =>
  attribute == null
    ? 0
    : ((attribute as Partial<VASizeDescription>).size ?? (attribute as {components: readonly string[]}).components.length);

function assertSpriteBase(base: SpriteBase): void {
  const {attributes, basePrototype} = base.description;
  if (sizeOf(attributes['position']) !== 3) {
    throw new TypeError(
      `${WHERE}: the base "${base.name}" needs a position attribute of 3 values — the vertex in the local quad space`,
    );
  }
  if (sizeOf(attributes['uv']) !== 2) {
    throw new TypeError(
      `${WHERE}: the base "${base.name}" needs a uv attribute of 2 values — where the vertex lies on the untrimmed sprite`,
    );
  }
  if (typeof (basePrototype as {make?: unknown} | null | undefined)?.make !== 'function') {
    throw new TypeError(`${WHERE}: the base "${base.name}" needs a make() on the basePrototype of its description`);
  }
}

function assertFeatureNames(base: SpriteBase, features: readonly SpriteFeature[]): void {
  const names = new Map<string, SpriteFeature>();
  for (const feature of features) {
    const first = names.get(feature.name);
    if (first != null) {
      // the forms of one factory — wave() — share a name: the check of the first may say what to do
      // about a second, before the refusal that only names the name
      runCheckKind(first, {base, features}, `${WHERE}: feature "${feature.name}"`);
      throw new Error(`${WHERE}: two features are named "${feature.name}"`);
    }
    names.set(feature.name, feature);
  }
  for (const feature of features) {
    for (const required of feature.requires ?? []) {
      if (!names.has(required)) {
        throw new Error(
          `${WHERE}: feature "${feature.name}" requires feature "${required}", which this sprite kind does not hold`,
        );
      }
    }
  }
}

function mergeAttributes(features: readonly SpriteFeature[], base: SpriteBase) {
  const attributes: VertexAttributesType = {};
  const attributeOwners = new Map<string, string>();
  const propertyOwners = new Map<string, string>();

  for (const feature of features) {
    const own = feature.attributes ?? {};
    for (const name of Object.keys(own)) {
      if (name in base.description.attributes) {
        throw new Error(
          `${WHERE}: feature "${feature.name}" declares the attribute "${name}", which the base "${base.name}" holds already`,
        );
      }
      const owner = attributeOwners.get(name);
      if (owner != null)
        throw new Error(`${WHERE}: features "${owner}" and "${feature.name}" both declare the attribute "${name}"`);
      attributeOwners.set(name, feature.name);
    }

    const descriptors = Object.entries(own).map(([name, description]) => new VertexAttributeDescriptor(name, description));
    // the instanced vertex object has one vertex, so the names carry no vertex index
    for (const {name} of vertexObjectPropertyNames(descriptors, 1, feature.methods)) {
      const owner = propertyOwners.get(name);
      if (owner === feature.name)
        throw new Error(`${WHERE}: feature "${feature.name}" gives the sprite the property "${name}" twice`);
      if (owner != null)
        throw new Error(`${WHERE}: features "${owner}" and "${feature.name}" both give the sprite the property "${name}"`);
      propertyOwners.set(name, feature.name);
    }

    Object.assign(attributes, own);
  }

  return {attributes, attributeOwners};
}

function mergeUsageAliases(features: readonly SpriteFeature[], attributeOwners: ReadonlyMap<string, string>) {
  const aliases: Record<string, readonly string[]> = {};
  const owners = new Map<string, string>();
  const declaresWord = (name: string, word: string) =>
    features.some(
      (feature) => feature.name === name && feature.usageAliases != null && Object.hasOwn(feature.usageAliases, word),
    );
  for (const feature of features) {
    for (const [word, targets] of Object.entries(feature.usageAliases ?? {})) {
      // a word named like an attribute of its own feature names that attribute and its targets —
      // `texCoords` of AtlasFrame. Another feature may add attributes of its own to such a word, when
      // the feature of the attribute declares it — NineSlice's insets, which setSliceFrame() writes
      // with the frame; named like the attribute of a feature that declares no such word it would steal it
      const attributeOwner = attributeOwners.get(word);
      if (attributeOwner != null && attributeOwner !== feature.name && !declaresWord(attributeOwner, word)) {
        throw new Error(
          `${WHERE}: feature "${feature.name}" declares the usage alias "${word}", which is an attribute of feature "${attributeOwner}"`,
        );
      }
      const owner = owners.get(word);
      if (owner != null && attributeOwner == null)
        throw new Error(`${WHERE}: features "${owner}" and "${feature.name}" both declare the usage alias "${word}"`);
      for (const target of targets) {
        if (feature.attributes?.[target] == null) {
          throw new Error(`${WHERE}: feature "${feature.name}" aliases "${word}" to "${target}", which it does not declare`);
        }
      }
      owners.set(word, feature.name);
      aliases[word] = Object.freeze([...(aliases[word] ?? []), ...targets]);
    }
  }
  return Object.freeze(aliases);
}

// `createVertexObjectPrototype` copies `Object.entries(methods)`, which skips symbol keys, so the
// hook lives on the basePrototype — and nothing else does, so rule 9 of the descriptor finds nothing
function initializerPrototype(features: readonly SpriteFeature[]): object {
  const initializers = features.flatMap((feature) => (feature.initialize != null ? [feature.initialize] : []));
  return Object.create(Object.prototype, {
    [voInitialize]: {
      value: function initialize(this: object) {
        // an index loop: the hook runs for every sprite createSprite() hands out and allocates nothing
        for (let i = 0; i < initializers.length; i++) initializers[i]!.call(this);
      },
    },
  });
}

function checkLayout(
  description: VertexObjectDescription,
  features: readonly SpriteFeature[],
  attributeOwners: Map<string, string>,
): void {
  for (const feature of features) {
    if (feature.attributes == null) continue;
    try {
      new VertexObjectDescriptor({attributes: feature.attributes});
    } catch (error) {
      throw new Error(`${WHERE}: feature "${feature.name}": ${(error as Error).message}`, {cause: error});
    }
  }
  try {
    // the descriptor every pool of the kind takes over: built once here, from the very object the
    // kind hands out, so the first pool finds it in the cache
    sharedVertexObjectDescriptor(description);
  } catch (error) {
    const message = (error as Error).message;
    const involved = [...attributeOwners]
      .filter(([attribute]) => message.includes(`"${attribute}"`))
      .map(([attribute, feature]) => `attribute "${attribute}" of feature "${feature}"`)
      .join(', ');
    throw new Error(`${WHERE}: the features do not fit into one sprite — ${involved}: ${message}`, {cause: error});
  }
}

/**
 * Merges a base and features into a sprite kind. Checks, in this order, and throws naming the
 * features involved: the options — an object with a base and an iterable of features —, every
 * feature on its own as `defineFeature()` checks it, the base contract, unique feature names —
 * where two share one, the `checkKind` of the first is asked first, so that the forms of one
 * factory can say why a kind takes one —, `requires`, one placement and at most one frame and
 * color source, a placement without textures, unique uniforms, textures, attributes,
 * sprite-handle properties and usage aliases, and the layout of the merged attributes — and last
 * the `checkKind` of every feature, in the order of the list.
 */
export function defineSprite<const F extends readonly SpriteFeature[]>(options: {
  readonly base: SpriteBase;
  readonly features: F;
}): SpriteKind<SpriteApiOf<F>> {
  if (!isObject(options) || Array.isArray(options)) {
    throw new TypeError(`${WHERE}: takes {base, features}, got ${describeValue(options)}`);
  }
  const {base} = options;
  if (!isObject(base) || !isObject(base.description)) {
    throw new TypeError(
      `${WHERE}: the base is no sprite base, got ${describeValue(base)} — QuadBase, gridBase() or a base of your own`,
    );
  }
  if (options.features == null || typeof (options.features as Partial<Iterable<unknown>>)[Symbol.iterator] !== 'function') {
    throw new TypeError(`${WHERE}: features is a list of features, got ${describeValue(options.features)}`);
  }
  const features: readonly SpriteFeature[] = Object.freeze([...options.features]);
  for (const feature of features) checkFeature(feature, WHERE);

  assertSpriteBase(base);
  assertFeatureNames(base, features);

  const pipeline = buildSpritePipeline(features, WHERE);
  if (pipeline.placement === undefined) {
    throw new Error(
      `${WHERE}: no feature contributes a placement stage; a sprite kind holds exactly one — FlatPlacement, GroundPlacement, another flatPlacement(), BillboardPlacement, axisBillboardPlacement() or segmentPlacement()`,
    );
  }
  if (pipeline.placement.textures != null) {
    throw new Error(
      `${WHERE}: feature "${pipeline.placement.name}" contributes the placement and declares textures; the placement runs always and cannot wait for a texture`,
    );
  }

  collectSpriteDeclarations(features, WHERE);

  const {attributes, attributeOwners} = mergeAttributes(features, base);
  const usageAliases = mergeUsageAliases(features, attributeOwners);
  const methods = Object.assign({}, ...features.map((feature) => feature.methods ?? {})) as Record<string, unknown>;

  // a copy of its own, frozen down to the components of every attribute: the attribute descriptions
  // a feature brings stay that feature's, and nothing written to them afterwards reaches the kind
  const description = deepFreeze(
    cloneVertexObjectDescription({attributes, methods, basePrototype: initializerPrototype(features)}),
  );
  checkLayout(description, features, attributeOwners);

  for (const feature of features) runCheckKind(feature, {base, features}, `${WHERE}: feature "${feature.name}"`);

  const kind = Object.freeze({base, features, description, usageAliases, pipeline});
  spriteKinds.add(kind);
  return kind;
}
