import {Mesh, type Texture} from 'three/webgpu';
import type {VO} from '../../vertex-objects/types.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {SpriteKind} from '../defineSprite.js';
import type {SpritePass} from '../passes/definePass.js';
import {passFeatures} from '../passes/passFeatures.js';
import type {SpriteFeature} from '../SpriteFeature.js';
import {FeatureSpritesGeometry, type FeatureSpritesGeometryParameters} from './FeatureSpritesGeometry.js';
import {FeatureSpritesMaterial, type FeatureSpritesMaterialParameters} from './FeatureSpritesMaterial.js';
import {SpriteResources, type SpriteUniformNode} from './SpriteResources.js';

// the mesh draws the sprites themselves; a pass material is built next to it, never as its material
export interface FeatureSpritesOptions<Api extends object = object>
  extends FeatureSpritesGeometryParameters,
    Omit<FeatureSpritesMaterialParameters, 'resources' | 'pass'> {
  /** A geometry of the same kind; it stays the caller's. Excludes `capacity`, `attributeUsage` and `baseArgs`. */
  geometry?: FeatureSpritesGeometry<Api>;
  /** A material of the same kind; it stays the caller's. Excludes every material parameter and `passes`. */
  material?: FeatureSpritesMaterial<Api>;
  /**
   * Further ways to draw the sprites, each a child mesh over the geometry of the sprites with a
   * material of its own — see {@link FeatureSprites.passes}. The material of the sprites and every
   * pass material share one set of uniforms and textures, which `textures` and `uniforms` start.
   * Pass names are distinct.
   */
  passes?: readonly SpritePass[];
}

/**
 * The mesh of one pass of a {@link FeatureSprites}: its child, over the same geometry, with a
 * material of its own built for the pass. It has no `update()`; the sprites update the geometry
 * once per frame for every pass. The sprites build and release it.
 */
export class FeatureSpritesPass<Api extends object = object> extends Mesh {
  declare material: FeatureSpritesMaterial<Api>;
  readonly pass: SpritePass;

  constructor(geometry: FeatureSpritesGeometry<Api>, material: FeatureSpritesMaterial<Api>, pass: SpritePass) {
    super(geometry, material);
    this.pass = pass;
    this.name = `twopoint5d.FeatureSprites.${pass.name}`;
    this.frustumCulled = false;
    this.renderOrder = pass.renderOrder ?? 0;
  }
}

const WHERE = 'FeatureSprites';

// a record of pass meshes by pass name: without a prototype, a pass named "__proto__" or
// "constructor" is an own entry like any other instead of a write to Object.prototype's members
const passRecord = <Api extends object>(): Record<string, FeatureSpritesPass<Api>> => Object.create(null);

const definedKeys = (record: object): string[] =>
  Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);

interface ResolvedParts<Api extends object> {
  geometry: FeatureSpritesGeometry<Api>;
  material: FeatureSpritesMaterial<Api>;
  ownsGeometry: boolean;
  /** The uniforms and textures every material shares, built only for passes. */
  resources: SpriteResources | undefined;
}

// Validates the options and builds what is not handed in, before the mesh exists, so that a refusal
// leaves nothing behind: every check runs before anything is built, and when the shared resources
// or the material cannot be built, what was built for them goes first
function resolveParts<Api extends object>(kind: SpriteKind<Api>, options: FeatureSpritesOptions<Api>): ResolvedParts<Api> {
  const {geometry, material, passes = [], capacity, attributeUsage, baseArgs, ...materialParameters} = options;

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
    if (passes.length > 0) {
      throw new TypeError(
        `${WHERE}: passes share the uniforms and textures of a material the sprites build; hand in no material with them`,
      );
    }
  }
  const passNames = new Set<string>();
  for (const pass of passes) {
    if (passNames.has(pass.name)) throw new TypeError(`${WHERE}: two passes are named "${pass.name}"`);
    passNames.add(pass.name);
    passFeatures(kind, pass, WHERE);
  }

  const builtGeometry = geometry ?? new FeatureSpritesGeometry(kind, {capacity, attributeUsage, baseArgs});
  let resources: SpriteResources | undefined;
  try {
    if (passes.length > 0) {
      // every uniform and texture of the kind and its passes, held once and shared by every material;
      // without passes the material builds and owns its own
      const {textures, uniforms, ...ownParameters} = materialParameters;
      resources = new SpriteResources(
        [...kind.features, ...passes.flatMap((pass) => pass.features)],
        {textures, uniforms},
        WHERE,
      );
      return {
        geometry: builtGeometry,
        material: new FeatureSpritesMaterial(kind, {...ownParameters, resources}),
        ownsGeometry: geometry == null,
        resources,
      };
    }
    return {
      geometry: builtGeometry,
      material: material ?? new FeatureSpritesMaterial(kind, materialParameters),
      ownsGeometry: geometry == null,
      resources: undefined,
    };
  } catch (error) {
    // the material that threw released what it built itself; the shared resources go after it, and
    // never a geometry handed in: that one stays the caller's
    resources?.dispose();
    if (geometry == null) builtGeometry.dispose();
    throw error;
  }
}

/**
 * The mesh that draws the sprites of a kind, one instance of its geometry per sprite. It builds
 * the geometry and the material it is not handed, and a child mesh with a material of its own for
 * every pass; what it builds belongs to it and goes with {@link dispose}, while a geometry, a
 * material or a texture handed in stays the caller's. Call `update()` once per frame before
 * rendering — it serves every pass as well.
 */
export class FeatureSprites<Api extends object = object> extends VertexObjects<FeatureSpritesGeometry<Api>> {
  declare geometry: FeatureSpritesGeometry<Api> | undefined;
  declare material: FeatureSpritesMaterial<Api> | undefined;

  readonly kind: SpriteKind<Api>;

  #ownsGeometry: boolean;
  #ownsMaterial: boolean;
  #resources: SpriteResources | undefined;
  #passes: Record<string, FeatureSpritesPass<Api>> = Object.freeze(passRecord<Api>());
  #disposed = false;

  /**
   * @param options every field is optional, so another three.js `Material` or a `Texture` would
   *   pass for them; the `isMaterial` and the `isTexture` they carry keep them out.
   * @throws a `TypeError` for a geometry or material of another kind, for parameters that would
   *   build a geometry or a material next to one handed in, for passes next to a material handed in
   *   and for two passes of one name; an `Error` for a pass the kind cannot draw. A constructor that
   *   throws leaves nothing behind it built.
   */
  constructor(kind: SpriteKind<Api>, options: FeatureSpritesOptions<Api> & {isMaterial?: never; isTexture?: never} = {}) {
    const {geometry, material, ownsGeometry, resources} = resolveParts(kind, options);

    super(geometry, material);

    this.kind = kind;
    // only the geometry, the materials and the resources built right here belong to this mesh
    this.#ownsGeometry = ownsGeometry;
    this.#ownsMaterial = options.material == null;
    this.#resources = resources;
    this.name = 'twopoint5d.FeatureSprites';

    try {
      // filled while the pass meshes are built, so that a dispose() on a throw finds those built so far
      const passes = passRecord<Api>();
      this.#passes = passes;
      for (const pass of options.passes ?? []) {
        // resources is defined whenever there are passes, so no pass material builds resources of its own
        const passMaterial = new FeatureSpritesMaterial(kind, {pass, resources, placement: material.placement});
        const mesh = new FeatureSpritesPass(geometry, passMaterial, pass);
        this.add(mesh);
        passes[pass.name] = mesh;
      }
      Object.freeze(passes);
    } catch (error) {
      // the pass material that threw released what it built itself; dispose() releases the rest —
      // the pass materials built so far, the material, the shared resources and a geometry built here
      this.dispose();
      throw error;
    }
  }

  /**
   * The meshes of the passes by pass name, children of this mesh, in a frozen record without a
   * prototype — empty once disposed. Each draws the geometry of the sprites with a material built
   * for its pass; that material reads the uniforms and textures of the sprites, so
   * {@link setUniform} and {@link setTexture} reach every pass.
   */
  get passes(): Readonly<Record<string, FeatureSpritesPass<Api>>> {
    return this.#passes;
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

  /**
   * Swaps the placement of the material and of every pass material; see
   * {@link FeatureSpritesMaterial.placement}. Does nothing once disposed.
   */
  set placement(feature: SpriteFeature) {
    if (this.material == null) return;
    // the material checks first, so a refused placement reaches no pass; the pass materials judge it
    // by the features of the kind as well, so they take what the material took
    this.material.placement = feature;
    for (const mesh of Object.values(this.#passes)) mesh.material.placement = feature;
  }

  /** The uniforms of the material — `undefined` once disposed. */
  get uniforms(): Readonly<Record<string, SpriteUniformNode>> | undefined {
    return this.material?.uniforms;
  }

  /**
   * Writes a uniform the sprites and every pass read; see {@link FeatureSpritesMaterial.setUniform}.
   * Does nothing once disposed.
   */
  setUniform(name: string, x: number, y?: number, z?: number, w?: number): void {
    this.material?.setUniform(name, x, y, z, w);
  }

  /** The texture `name` — `undefined` while it is unset, and once disposed. */
  getTexture(name: string): Texture | undefined {
    return this.material?.getTexture(name);
  }

  /**
   * Sets the texture `name` for the sprites and every pass; it stays the caller's. See
   * {@link FeatureSpritesMaterial.setTexture}. Does nothing once disposed.
   */
  setTexture(name: string, texture: Texture | undefined): void {
    this.material?.setTexture(name, texture);
  }

  /**
   * Re-reads the texture `name` once a loader filled in its image; see
   * {@link FeatureSpritesMaterial.touchTexture}. Does nothing once disposed.
   */
  touchTexture(name: string): void {
    this.material?.touchTexture(name);
  }

  /**
   * Releases the geometry and the material this mesh built, the pass meshes with their materials
   * and the uniforms and textures they shared. The mesh leaves the scene graph first and fires
   * three's `dispose` event, so the renderer drops what it built for it; every pass mesh leaves this
   * mesh and fires the event as well. Afterwards `geometry`, `material`, `spritePool`, `placement`
   * and `uniforms` answer `undefined`, and so do `createSprite()` and `getTexture()`; `passes` is
   * empty; `freeSprite()`, `setUniform()`, `setTexture()`, `touchTexture()`, `update()` and the
   * `placement` setter do nothing. A second call does nothing.
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

    for (const mesh of Object.values(this.#passes)) {
      mesh.removeFromParent();
      // three's dispose event for the pass mesh as well, so the renderer drops its render objects
      mesh.dispose();
      mesh.material.dispose();
    }
    this.#passes = Object.freeze(passRecord<Api>());

    if (this.#ownsGeometry) this.geometry?.dispose();
    this.geometry = undefined;

    if (this.#ownsMaterial) this.material?.dispose();
    this.material = undefined;

    // the materials borrowed the resources; they go after every material that read them
    this.#resources?.dispose();
    this.#resources = undefined;
  }
}
