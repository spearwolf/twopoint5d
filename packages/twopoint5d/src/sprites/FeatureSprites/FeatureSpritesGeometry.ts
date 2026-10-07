import {expectDefined} from '../../utils/expectDefined.js';
import {
  cloneVertexObjectDescription,
  type VertexAttributeUsageOverrides,
} from '../../vertex-objects/cloneVertexObjectDescription.js';
import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {VertexObjectDescription, VO} from '../../vertex-objects/types.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {SpriteKind} from '../defineSprite.js';
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
  declare readonly basePool: VertexObjectPool<SpriteBaseVO>;
  declare readonly instancedPool: VertexObjectPool<Api & VO>;

  readonly isFeatureSpritesGeometry = true;

  readonly kind: SpriteKind<Api>;

  constructor(kind: SpriteKind<Api>, parameters: number | FeatureSpritesGeometryParameters = 100) {
    const {
      capacity = 100,
      attributeUsage,
      baseArgs = kind.base.defaultArgs,
    } = typeof parameters === 'number' ? {capacity: parameters} : parameters;

    super(descriptionOf(kind as SpriteKind, attributeUsage), capacity, kind.base.description);

    this.kind = kind;
    this.name = 'twopoint5d.FeatureSpritesGeometry';

    // the base pool is new and holds one slot, so createVO() cannot come back empty; expectDefined()
    // states that without leaving a branch no input reaches
    expectDefined(this.basePool.createVO(), 'the base vertex object').make(...baseArgs);
  }
}
