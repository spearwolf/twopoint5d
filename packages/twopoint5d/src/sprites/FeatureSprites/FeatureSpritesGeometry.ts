import {describeValue} from '../../utils/describeValue.js';
import {expectDefined} from '../../utils/expectDefined.js';
import {isObject} from '../../utils/isObject.js';
import {
  cloneVertexObjectDescription,
  type VertexAttributeUsageOverrides,
} from '../../vertex-objects/cloneVertexObjectDescription.js';
import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {VertexObjectDescription, VO} from '../../vertex-objects/types.js';
import type {VertexObjectDescriptor} from '../../vertex-objects/VertexObjectDescriptor.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {checkSpriteKind, type SpriteKind} from '../defineSprite.js';
import type {SpriteBaseVO} from '../SpriteBase.js';

export interface FeatureSpritesGeometryParameters {
  /** How many sprites the geometry holds. Default 100. */
  capacity?: number;
  // no `alias`: the kind brings its usage words, and one set by the caller would replace them
  /**
   * The attributes that take another usage than the kind declares, by attribute name or by a usage
   * word of a feature (`size`, `position`, `texCoords`). A word names every attribute behind it.
   *
   * A geometry built with `attributeUsage` copies the description of the kind and shares its
   * descriptor and the prototype of its sprites with no other geometry.
   */
  attributeUsage?: Omit<VertexAttributeUsageOverrides, 'alias'>;
  /** What `make()` of the base is called with; default: the `defaultArgs` of the base. */
  baseArgs?: readonly unknown[];
}

const WHERE = 'FeatureSpritesGeometry';

// the key under which grown() hands the constructor the descriptor of the geometry it grows from:
// a symbol of this module, which no caller of the public constructor holds
const growthDescriptor = Symbol('growthDescriptor');

interface GrowthParameters extends FeatureSpritesGeometryParameters {
  readonly [growthDescriptor]?: VertexObjectDescriptor;
}

const isRecord = (value: unknown): value is Record<string, unknown> => isObject(value) && !Array.isArray(value);

// the form of the parameters, before anything is built: what the pool and the base would read of
// them otherwise throws without a subject, or builds with a part of them left out unseen
function checkParameters(parameters: unknown): GrowthParameters {
  if (typeof parameters === 'number') return {capacity: parameters};
  if (!isRecord(parameters)) {
    throw new TypeError(`${WHERE}: the parameters must be a number or an object, got ${describeValue(parameters)}`);
  }
  const {baseArgs, attributeUsage} = parameters;
  if (baseArgs != null && !Array.isArray(baseArgs)) {
    throw new TypeError(`${WHERE}: baseArgs is a list of arguments, got ${describeValue(baseArgs)}`);
  }
  if (attributeUsage != null) {
    if (!isRecord(attributeUsage)) {
      throw new TypeError(`${WHERE}: attributeUsage must be an object, got ${describeValue(attributeUsage)}`);
    }
    for (const usage of ['dynamic', 'stream', 'static'] as const) {
      const names = attributeUsage[usage];
      if (names != null && !(Array.isArray(names) && names.every((name) => typeof name === 'string'))) {
        throw new TypeError(`${WHERE}: attributeUsage.${usage} is a list of names, got ${describeValue(names)}`);
      }
    }
  }
  return parameters as GrowthParameters;
}

function descriptionOf(
  kind: SpriteKind,
  attributeUsage: FeatureSpritesGeometryParameters['attributeUsage'],
): VertexObjectDescription {
  // without a usage of its own the geometry takes the description of the kind as it is, so that it
  // shares the descriptor and the prototype of its sprites with every such geometry
  if (attributeUsage == null) return kind.description;

  // a set: a usage word may be named like an attribute of its own feature (`texCoords`)
  const known = [...new Set([...Object.keys(kind.description.attributes), ...Object.keys(kind.usageAliases)])];
  for (const name of [...(attributeUsage.dynamic ?? []), ...(attributeUsage.stream ?? []), ...(attributeUsage.static ?? [])]) {
    if (!known.includes(name)) {
      throw new Error(
        `${WHERE}: attributeUsage names "${name}", which is neither an attribute nor a usage word of the sprite kind; it knows ${known.join(', ')}`,
      );
    }
  }

  return cloneVertexObjectDescription(kind.description, {
    dynamic: attributeUsage.dynamic,
    stream: attributeUsage.stream,
    static: attributeUsage.static,
    alias: Object.fromEntries(Object.entries(kind.usageAliases).map(([word, targets]) => [word, [...targets]])),
  });
}

/** The instanced geometry of a sprite kind: the base as base geometry, one instance per sprite. */
export class FeatureSpritesGeometry<Api extends object = object> extends InstancedVertexObjectGeometry<Api & VO, SpriteBaseVO> {
  // the constructor hands super() a base description, never a BufferGeometry, so the base pool is always there
  /** The pool of the one base vertex object: the quad or the grid of the base. */
  declare readonly basePool: VertexObjectPool<SpriteBaseVO>;
  /** The pool of the sprites, one instance per sprite. */
  declare readonly instancedPool: VertexObjectPool<Api & VO>;

  /** Marks a `FeatureSpritesGeometry`, as the `is…` flags of three do. */
  readonly isFeatureSpritesGeometry = true;

  /** The sprite kind the geometry is built for. */
  readonly kind: SpriteKind<Api>;

  /**
   * Builds the geometry of `kind` for `capacity` sprites — a number, or `parameters.capacity`, 100
   * without either — and calls `make()` of the base vertex object with `baseArgs`, or with the
   * `defaultArgs` of the base without them.
   *
   * @throws a `TypeError` for a kind that did not come from `defineSprite()`, for parameters that
   *   are neither a number nor an object, for `baseArgs` that are no list, for an `attributeUsage`
   *   that is no object and for a `dynamic`, `stream` or `static` of it that is no list of names,
   *   and an `Error` for a name in `attributeUsage` the kind does not know — each before anything
   *   is built; a `RangeError` of `VertexObjectBuffer` for a capacity that is no whole number of 0
   *   or more.
   */
  constructor(kind: SpriteKind<Api>, parameters: number | FeatureSpritesGeometryParameters = 100) {
    checkSpriteKind(kind, WHERE);
    const options = checkParameters(parameters);
    // null counts as not handed in, as it does for attributeUsage
    const {capacity = 100, attributeUsage} = options;
    const baseArgs = options.baseArgs ?? kind.base.defaultArgs;

    super(options[growthDescriptor] ?? descriptionOf(kind as SpriteKind, attributeUsage), capacity, kind.base.description);

    this.kind = kind;
    this.name = 'twopoint5d.FeatureSpritesGeometry';

    // the base pool is new and holds one slot, so createVO() cannot come back empty; expectDefined()
    // states that without leaving a branch no input reaches
    expectDefined(this.basePool.createVO(), 'the base vertex object').make(...baseArgs);
  }

  /**
   * A geometry of `capacity` sprites that takes the sprites of this one over: the same kind, the
   * same descriptor — so the usage of every attribute and the prototype of the handles stay —, the
   * base vertices and the name copied, and every sprite adopted by its pool
   * (`VertexObjectPool#adoptVOs`), handles, values, order and the `onCreateVO` hook of the pool
   * included. This geometry is left with an empty pool. `FeatureSprites` calls it to grow.
   *
   * @internal
   */
  grown(capacity: number): FeatureSpritesGeometry<Api> {
    const parameters: GrowthParameters = {capacity, [growthDescriptor]: this.instancedPool.descriptor};
    const grown = new FeatureSpritesGeometry(this.kind, parameters);
    grown.name = this.name;
    grown.basePool.buffer.copy(this.basePool.buffer);
    grown.instancedPool.adoptVOs(this.instancedPool);
    return grown;
  }
}
