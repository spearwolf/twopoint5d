import type {Texture} from 'three/webgpu';
import type {VO} from '../../vertex-objects/types.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {SpriteKind} from '../defineSprite.js';
import type {SpriteFeature} from '../SpriteFeature.js';
import {FeatureSpritesGeometry, type FeatureSpritesGeometryParameters} from './FeatureSpritesGeometry.js';
import {FeatureSpritesMaterial, type FeatureSpritesMaterialParameters} from './FeatureSpritesMaterial.js';
import type {SpriteUniformNode} from './SpriteResources.js';

export interface FeatureSpritesOptions<Api extends object = object>
  extends FeatureSpritesGeometryParameters,
    Omit<FeatureSpritesMaterialParameters, 'resources'> {
  /** A geometry of the same kind; it stays the caller's. Excludes `capacity`, `attributeUsage` and `baseArgs`. */
  geometry?: FeatureSpritesGeometry<Api>;
  /** A material of the same kind; it stays the caller's. Excludes every material parameter. */
  material?: FeatureSpritesMaterial<Api>;
}

const WHERE = 'FeatureSprites';

const definedKeys = (record: object): string[] =>
  Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);

// Validates the options and builds what is not handed in, before the mesh exists, so that a refusal
// leaves nothing behind: when the material cannot be built, the geometry built for it goes first
function resolveParts<Api extends object>(
  kind: SpriteKind<Api>,
  options: FeatureSpritesOptions<Api>,
): {geometry: FeatureSpritesGeometry<Api>; material: FeatureSpritesMaterial<Api>; ownsGeometry: boolean} {
  const {geometry, material, capacity, attributeUsage, baseArgs, ...materialParameters} = options;

  if (geometry != null) {
    if (geometry.kind !== kind) throw new TypeError(`${WHERE}: the geometry handed in was built for another sprite kind`);
    if (definedKeys({capacity, attributeUsage, baseArgs}).length > 0) {
      throw new TypeError(`${WHERE}: capacity, attributeUsage and baseArgs build a geometry, and a geometry was handed in`);
    }
  }
  if (material != null) {
    if (material.kind !== kind) throw new TypeError(`${WHERE}: the material handed in was built for another sprite kind`);
    const given = definedKeys(materialParameters);
    if (given.length > 0) throw new TypeError(`${WHERE}: ${given.join(', ')} build a material, and a material was handed in`);
  }

  const builtGeometry = geometry ?? new FeatureSpritesGeometry(kind, {capacity, attributeUsage, baseArgs});
  try {
    return {
      geometry: builtGeometry,
      material: material ?? new FeatureSpritesMaterial(kind, materialParameters),
      ownsGeometry: geometry == null,
    };
  } catch (error) {
    // never a geometry handed in: that one stays the caller's
    if (geometry == null) builtGeometry.dispose();
    throw error;
  }
}

/**
 * The mesh that draws the sprites of a kind, one instance of its geometry per sprite. It builds
 * the geometry and the material it is not handed; what it builds belongs to it and goes with
 * {@link dispose}, while a geometry, a material or a texture handed in stays the caller's.
 * Call `update()` once per frame before rendering.
 */
export class FeatureSprites<Api extends object = object> extends VertexObjects<FeatureSpritesGeometry<Api>> {
  declare geometry: FeatureSpritesGeometry<Api> | undefined;
  declare material: FeatureSpritesMaterial<Api> | undefined;

  readonly kind: SpriteKind<Api>;

  #ownsGeometry: boolean;
  #ownsMaterial: boolean;
  #disposed = false;

  /**
   * @param options every field is optional, so another three.js `Material` or a `Texture` would
   *   pass for them; the `isMaterial` and the `isTexture` they carry keep them out.
   * @throws a `TypeError` for a geometry or material of another kind, and for parameters that would
   *   build a geometry or a material next to one handed in
   */
  constructor(kind: SpriteKind<Api>, options: FeatureSpritesOptions<Api> & {isMaterial?: never; isTexture?: never} = {}) {
    const {geometry, material, ownsGeometry} = resolveParts(kind, options);

    super(geometry, material);

    this.kind = kind;
    // only the geometry and the material built right here belong to this mesh
    this.#ownsGeometry = ownsGeometry;
    this.#ownsMaterial = options.material == null;
    this.name = 'twopoint5d.FeatureSprites';
  }

  /** The sprite pool of the geometry — `undefined` once disposed. */
  get spritePool(): VertexObjectPool<Api & VO> | undefined {
    return this.geometry?.instancedPool;
  }

  /**
   * Takes a sprite from the pool, at the values of an unused slot: 0 everywhere, white as its tint.
   * Answers `undefined` once the pool is full or the sprites are disposed.
   */
  createSprite(): (Api & VO) | undefined {
    return this.geometry?.instancedPool.createVO();
  }

  /** Gives a sprite back; the last sprite moves into its slot. Does nothing once disposed. */
  freeSprite(sprite: VO): void {
    this.geometry?.instancedPool.freeVO(sprite);
  }

  /** The placement of the material — `undefined` once disposed. */
  get placement(): SpriteFeature | undefined {
    return this.material?.placement;
  }

  /** Swaps the placement; see {@link FeatureSpritesMaterial.placement}. Does nothing once disposed. */
  set placement(feature: SpriteFeature) {
    if (this.material != null) this.material.placement = feature;
  }

  /** The uniforms of the material — `undefined` once disposed. */
  get uniforms(): Readonly<Record<string, SpriteUniformNode>> | undefined {
    return this.material?.uniforms;
  }

  setUniform(name: string, x: number, y?: number, z?: number, w?: number): void {
    this.material?.setUniform(name, x, y, z, w);
  }

  getTexture(name: string): Texture | undefined {
    return this.material?.getTexture(name);
  }

  setTexture(name: string, texture: Texture | undefined): void {
    this.material?.setTexture(name, texture);
  }

  touchTexture(name: string): void {
    this.material?.touchTexture(name);
  }

  /**
   * Releases the geometry and the material this mesh built. The mesh leaves the scene graph first
   * and fires three's `dispose` event, so the renderer drops what it built for it. Afterwards
   * `geometry`, `material`, `spritePool`, `placement` and `uniforms` answer `undefined`, and every
   * other member does nothing. A second call does nothing.
   */
  override dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // a mesh without geometry and material cannot be rendered, so it leaves the scene graph
    // before it gives them up
    this.removeFromParent();

    // three's dispose event: the renderer drops what it built for this mesh, which a geometry or a
    // material handed in and left alive below would otherwise keep in its caches
    super.dispose();

    if (this.#ownsGeometry) this.geometry?.dispose();
    this.geometry = undefined;

    if (this.#ownsMaterial) this.material?.dispose();
    this.material = undefined;
  }
}
