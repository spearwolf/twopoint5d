import {type Camera, Matrix4, Mesh, type Texture, Vector2, Vector3, Vector4} from 'three/webgpu';
import type {VO, VOSortKey, VOSortKeyName, VOSortOptions} from '../../vertex-objects/types.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {describeThreeValue} from '../../utils/describeThreeValue.js';
import {describeValue} from '../../utils/describeValue.js';
import {isObject} from '../../utils/isObject.js';
import {throwCollected} from '../../utils/throwCollected.js';
import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {SpriteUniformSource} from '../bindings/SpriteUniformSource.js';
import {checkFeature} from '../checkFeature.js';
import {checkSpriteKind, type SpriteKind} from '../defineSprite.js';
import type {SpritePass} from '../passes/definePass.js';
import {checkPass, checkPassFeatures, passFeatures, placementOfPass} from '../passes/passFeatures.js';
import {resolvedUniformName, stageFeaturesOf} from '../passes/passUniformNames.js';
import {thrownMessage} from '../runCheckKind.js';
import type {SpriteFeature} from '../SpriteFeature.js';
import {FeatureSpritesGeometry, type FeatureSpritesGeometryParameters} from './FeatureSpritesGeometry.js';
import {checkPlacementStandIn, FeatureSpritesMaterial, type FeatureSpritesMaterialParameters} from './FeatureSpritesMaterial.js';
import {SpriteResources, type SpriteUniformNode} from './SpriteResources.js';

// the mesh draws the sprites themselves; a pass material is built next to it, never as its material
/**
 * The options of {@link FeatureSprites}: those of the geometry and of the material side by side,
 * and `geometry`, `material`, `grow` and `passes`. Every field is optional.
 */
export interface FeatureSpritesOptions<Api extends object = object>
  extends FeatureSpritesGeometryParameters,
    Omit<FeatureSpritesMaterialParameters, 'resources' | 'pass'> {
  /** A geometry of the same kind; it stays the caller's. Excludes `capacity`, `attributeUsage` and `baseArgs`. */
  geometry?: FeatureSpritesGeometry<Api>;
  /** A material of the same kind; it stays the caller's. Excludes every material parameter and `passes`. */
  material?: FeatureSpritesMaterial<Api>;
  /**
   * A full pool grows instead of refusing: the {@link FeatureSprites.createSprite} that finds every
   * slot in use builds a geometry of twice the capacity, moves every sprite over — handles, values
   * and order — and answers a sprite of the new pool. A frame hitch, noted on the console once per
   * mesh. Default `false`. Excludes `geometry`, which the sprites do not own and cannot replace.
   */
  grow?: boolean;
  /**
   * Further ways to draw the sprites, each a child mesh over the geometry of the sprites with a
   * material of its own — see {@link FeatureSprites.passes}. The material of the sprites and every
   * pass material share one set of uniforms and textures, which `textures` and `uniforms` start.
   * Pass names are distinct.
   */
  passes?: readonly SpritePass[];
}

// what code of the caller threw, as an Error in the words of `where`; a refusal that names `where`
// already — uniform() of a pass hook asked for a name no feature declares — goes on as it is
const callerError = (where: string, error: unknown): unknown =>
  error instanceof Error && error.message.startsWith(`${where} `)
    ? error
    : new Error(`${where} threw: ${thrownMessage(error)}`, {cause: error});

/**
 * The mesh of one pass of a {@link FeatureSprites}: its child, over the geometry of the sprites — it
 * follows a geometry put into their `geometry` slot — with a material of its own built for the pass.
 * It has no `update()`; the sprites update the geometry once per frame for every pass. The sprites
 * build and release it.
 */
export class FeatureSpritesPass<Api extends object = object> extends Mesh {
  /** The material built for {@link pass}; the sprites build and release it. */
  declare material: FeatureSpritesMaterial<Api>;

  /** The pass this mesh draws. */
  readonly pass: SpritePass;

  #enabled = true;
  #hookAgrees = true;
  // built once: the hook runs every frame and must not allocate
  readonly #uniform: (name: string) => SpriteUniformNode;
  readonly #where: string;

  /**
   * The sprites build one per pass, over their geometry and with the material built for the pass;
   * it is not built on its own.
   */
  constructor(geometry: FeatureSpritesGeometry<Api>, material: FeatureSpritesMaterial<Api>, pass: SpritePass) {
    super(geometry, material);
    this.pass = pass;
    this.name = `twopoint5d.FeatureSprites.${pass.name}`;
    this.frustumCulled = false;
    this.renderOrder = pass.renderOrder ?? 0;
    const where = `FeatureSprites: the visible of pass "${pass.name}"`;
    this.#where = where;
    this.#uniform = (name) => material.resources.uniform(resolvedUniformName(pass, name), where);
  }

  /**
   * The caller's switch: the pass is drawn while it is on and its `visible` hook agrees. Use it
   * instead of `visible`, which `FeatureSprites#update()` writes for a pass with a hook.
   */
  get enabled(): boolean {
    return this.#enabled;
  }

  set enabled(enabled: boolean) {
    this.#enabled = enabled;
    this.visible = enabled && this.#hookAgrees;
  }

  /** Asks the `visible` hook of the pass for this frame; the sprites call it for passes that have one. @internal */
  judgeVisibility(): void {
    let agrees: boolean;
    try {
      agrees = this.pass.visible!(this.#uniform);
    } catch (error) {
      // the pass keeps the visibility of its last judgement
      throw callerError(this.#where, error);
    }
    this.#hookAgrees = agrees;
    this.visible = this.#enabled && agrees;
  }
}

const WHERE = 'FeatureSprites';

/**
 * The names of the number properties of a sprite handle `Api` — what {@link FeatureSprites.sortBy}
 * takes by name: `'y'`, `'z'`, `'rotation'`, `'width'` and every other number a feature declares.
 */
export type SpriteSortKeyName<Api> = {[K in keyof Api]-?: Api[K] extends number ? K : never}[keyof Api] & string;

// a record of pass meshes by pass name: without a prototype, a pass named "__proto__" or
// "constructor" is an own entry like any other instead of a write to Object.prototype's members
const passRecord = <Api extends object>(): Record<string, FeatureSpritesPass<Api>> => Object.create(null);

const typeOfUniform = (node: SpriteUniformNode): string =>
  node.value instanceof Vector4
    ? 'vec4'
    : node.value instanceof Vector3
      ? 'vec3'
      : node.value instanceof Vector2
        ? 'vec2'
        : 'float';

// one binding: the source and the vector of the uniform it writes, of one type, so that update()
// hands each source its vector without a cast, walking the list by index
type UniformBinding =
  | {
      readonly type: 'vec3';
      readonly name: string;
      readonly source: Extract<SpriteUniformSource, {type: 'vec3'}>;
      readonly vector: Vector3;
    }
  | {
      readonly type: 'vec4';
      readonly name: string;
      readonly source: Extract<SpriteUniformSource, {type: 'vec4'}>;
      readonly vector: Vector4;
    };

const definedKeys = (record: object): string[] =>
  Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);

interface ResolvedParts<Api extends object> {
  geometry: FeatureSpritesGeometry<Api>;
  material: FeatureSpritesMaterial<Api>;
  ownsGeometry: boolean;
  grows: boolean;
  /** The uniforms and textures every material shares, built only for passes. */
  resources: SpriteResources | undefined;
}

// Validates the options and builds what is not handed in, before the mesh exists, so that a refusal
// leaves nothing behind: every check runs before anything is built, and when the shared resources
// or the material cannot be built, what was built for them goes first
function resolveParts<Api extends object>(kind: SpriteKind<Api>, options: FeatureSpritesOptions<Api>): ResolvedParts<Api> {
  // the kind is the first argument, so it is checked first
  checkSpriteKind(kind, WHERE);
  // the default of the constructor holds for `undefined` alone
  if (!isObject(options as unknown) || Array.isArray(options)) {
    throw new TypeError(`${WHERE}: the options must be an object, got ${describeValue(options)}`);
  }
  const {geometry, material, passes = [], capacity, attributeUsage, baseArgs, grow, ...materialParameters} = options;
  // an array and not any iterable: `passes.length` and `passes.flatMap()` read it
  if (!Array.isArray(passes)) {
    throw new TypeError(`${WHERE}: passes is a list of passes, got ${describeValue(passes)}`);
  }

  if (grow !== undefined && typeof grow !== 'boolean') {
    throw new TypeError(`${WHERE}: grow is true or false, got ${describeValue(grow)}`);
  }
  if (geometry != null) {
    if (!(geometry instanceof FeatureSpritesGeometry)) {
      throw new TypeError(
        `${WHERE}: the geometry handed in is no FeatureSpritesGeometry, got ${describeThreeValue(geometry, 'isBufferGeometry')}`,
      );
    }
    if (geometry.kind !== kind) throw new TypeError(`${WHERE}: the geometry handed in was built for another sprite kind`);
    if (grow === true) {
      throw new TypeError(
        `${WHERE}: grow builds a larger geometry once the pool is full, and a geometry was handed in, which the sprites do not own — leave out grow, or leave out the geometry and give the sprites the capacity (attributeUsage, baseArgs) to build their own`,
      );
    }
    if (definedKeys({capacity, attributeUsage, baseArgs}).length > 0) {
      throw new TypeError(`${WHERE}: capacity, attributeUsage and baseArgs build a geometry, and a geometry was handed in`);
    }
  }
  if (material != null) {
    if (!(material instanceof FeatureSpritesMaterial)) {
      throw new TypeError(
        `${WHERE}: the material handed in is no FeatureSpritesMaterial, got ${describeThreeValue(material, 'isMaterial')}`,
      );
    }
    if (material.kind !== kind) throw new TypeError(`${WHERE}: the material handed in was built for another sprite kind`);
    const given = definedKeys(materialParameters);
    if (given.length > 0) throw new TypeError(`${WHERE}: ${given.join(', ')} build a material, and a material was handed in`);
    if (passes.length > 0) {
      throw new TypeError(
        `${WHERE}: passes share the uniforms and textures of a material the sprites build; hand in no material with them`,
      );
    }
  }
  // the placement is checked against every pass before the material sees it, so it is checked for its form first
  if (materialParameters.placement != null) checkFeature(materialParameters.placement, WHERE);
  const passNames = new Set<string>();
  for (const pass of passes) {
    checkPass(pass, WHERE);
    if (passNames.has(pass.name)) throw new TypeError(`${WHERE}: two passes are named "${pass.name}"`);
    passNames.add(pass.name);
    passFeatures(kind, pass, WHERE);
    // the sprites may start with another placement than the one of the kind, and every pass draws next to it
    if (materialParameters.placement != null) checkPassFeatures(kind, pass, materialParameters.placement, WHERE);
  }

  const builtGeometry = geometry ?? new FeatureSpritesGeometry(kind, {capacity, attributeUsage, baseArgs});
  const grows = grow === true;
  let resources: SpriteResources | undefined;
  try {
    if (passes.length > 0) {
      // every uniform and texture of the kind and its passes, held once and shared by every material;
      // without passes the material builds and owns its own
      const {textures, uniforms, ...ownParameters} = materialParameters;
      resources = new SpriteResources(
        [...kind.features, ...passes.flatMap((pass) => stageFeaturesOf(pass))],
        {textures, uniforms},
        WHERE,
      );
      return {
        geometry: builtGeometry,
        material: new FeatureSpritesMaterial(kind, {...ownParameters, resources}),
        ownsGeometry: geometry == null,
        grows,
        resources,
      };
    }
    return {
      geometry: builtGeometry,
      material: material ?? new FeatureSpritesMaterial(kind, materialParameters),
      ownsGeometry: geometry == null,
      grows,
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
 * The mesh of kind `K`, `FeatureSprites<SpriteKindApiOf<K>>`: the type of a field or a parameter
 * that holds `new FeatureSprites(K, …)`, written as `FeatureSpritesOf<typeof K>`.
 */
export type FeatureSpritesOf<K> = K extends SpriteKind<infer Api> ? FeatureSprites<Api> : never;

/**
 * The mesh that draws the sprites of a kind, one instance of its geometry per sprite. It builds
 * the geometry and the material it is not handed, and a child mesh with a material of its own for
 * every pass; what it builds belongs to it and goes with {@link dispose}, while a geometry, a
 * material or a texture handed in stays the caller's — and so does a material or a geometry the
 * caller puts into a slot later. A geometry put into the `geometry` slot is the geometry of the
 * sprites from then on, for the mesh, every pass and the sprite API alike. Call `update()` once per
 * frame before rendering — it writes the bound uniforms, judges the `visible` hook of every pass and serves
 * every pass as well.
 */
export class FeatureSprites<Api extends object = object> extends VertexObjects<FeatureSpritesGeometry<Api>> {
  /**
   * The geometry the sprites draw — `undefined` once disposed. Under `grow` a growth replaces it
   * with a larger one and disposes the old one: read it from the mesh afresh. A geometry the caller
   * puts into this slot stays the caller's, and it is the geometry of the sprites from then on: the
   * mesh and every pass mesh draw it, and `createSprite()`, `freeSprite()`, `sortBy()`,
   * `sortByViewDepth()` and `spritePool` work on its pool. A handle of the geometry before stays with
   * that one, and `freeSprite()` leaves it alone.
   */
  declare geometry: FeatureSpritesGeometry<Api> | undefined;
  /**
   * The slot three draws the mesh with — `undefined` once disposed. A material the caller puts here
   * stays the caller's, who disposes it. The API of the sprites — `placement`, `uniforms`,
   * `setUniform()`, `bindUniform()`, the textures and `update()` — speaks to the material the sprites
   * were built with, and so do the passes, whatever the slot holds.
   */
  declare material: FeatureSpritesMaterial<Api> | undefined;

  /** The sprite kind the mesh draws, handed to the constructor. */
  readonly kind: SpriteKind<Api>;

  // the geometry this mesh built, `undefined` for one handed in: the one dispose() and a growth release,
  // whatever the geometry slot holds
  #builtGeometry: FeatureSpritesGeometry<Api> | undefined;
  // the geometry in the slot, behind the accessor the constructor puts on the instance
  #slotGeometry: FeatureSpritesGeometry<Api> | undefined;
  // the material of the sprites, built or handed in: the one their API and their passes speak to,
  // whatever the material slot holds; #ownsMaterial says whether it was built here
  #material: FeatureSpritesMaterial<Api> | undefined;
  readonly #ownsMaterial: boolean;
  readonly #grows: boolean;
  #resources: SpriteResources | undefined;
  #passes: Record<string, FeatureSpritesPass<Api>> = Object.freeze(passRecord<Api>());
  #judgedPasses: readonly FeatureSpritesPass<Api>[] = [];
  // walked by index, so that update() needs no iterator
  readonly #bindings: UniformBinding[] = [];
  readonly #worldToSprites = new Matrix4();
  #disposed = false;
  // createSprite() says once that the pool is full, or — under grow — that it grew
  #warnedFull = false;
  #notedGrowth = false;
  // sortByViewDepth(): the camera's view of the mesh
  readonly #modelView = new Matrix4();

  /**
   * @param options every field is optional, so another three.js `Material` or a `Texture` would
   *   pass for them; the `isMaterial` and the `isTexture` they carry keep them out.
   * @throws a `TypeError` for a kind that did not come from `defineSprite()`, for a `geometry` or a
   *   `material` that is no `FeatureSpritesGeometry` or `FeatureSpritesMaterial`, for a geometry or
   *   material of another kind, for parameters that would build a geometry or a material next to
   *   one handed in, for passes next to a material handed in and for two passes of one name, for
   *   options that are no object, for `passes` that are no list and for a `grow` that is neither
   *   `true` nor `false`; an `Error` for a pass the kind cannot draw, with the placement the
   *   sprites start with; what `new FeatureSpritesGeometry()` and `new FeatureSpritesMaterial()`
   *   refuse of the options, in their name; and what `new SpriteResources()` refuses of `textures`
   *   and `uniforms`, in the name of the class that builds the resources — `FeatureSpritesMaterial`
   *   without passes, `FeatureSprites` with them. A constructor that throws leaves nothing behind
   *   it built.
   */
  constructor(kind: SpriteKind<Api>, options: FeatureSpritesOptions<Api> & {isMaterial?: never; isTexture?: never} = {}) {
    const {geometry, material, ownsGeometry, grows, resources} = resolveParts(kind, options);

    super(geometry, material);

    this.kind = kind;
    // only the geometry, the materials and the resources built right here belong to this mesh
    this.#builtGeometry = ownsGeometry ? geometry : undefined;
    this.#material = material;
    this.#ownsMaterial = options.material == null;
    this.#grows = grows;
    this.#resources = resources;
    this.name = 'twopoint5d.FeatureSprites';
    this.#slotGeometry = geometry;
    // three's Mesh writes and reads the slot inside its own constructor, before the private fields
    // of this class exist, so the accessor that lets the pass meshes follow the slot goes onto the
    // instance here rather than onto the prototype
    Object.defineProperty(this, 'geometry', {
      configurable: true,
      enumerable: true,
      get: () => this.#slotGeometry,
      set: (next: FeatureSpritesGeometry<Api> | undefined) => this.#putGeometry(next),
    });

    try {
      // filled while the pass meshes are built, so that a dispose() on a throw finds those built so far
      const passes = passRecord<Api>();
      this.#passes = passes;
      for (const pass of options.passes ?? []) {
        // resources is defined whenever there are passes, so no pass material builds resources of its own
        // a pass that brings a placement draws with its own and takes none of the sprites
        const placement = placementOfPass(pass) == null ? material.placement : undefined;
        const passMaterial = new FeatureSpritesMaterial(kind, {pass, resources, placement});
        const mesh = new FeatureSpritesPass(geometry, passMaterial, pass);
        this.add(mesh);
        passes[pass.name] = mesh;
      }
      Object.freeze(passes);
      this.#judgedPasses = Object.values(passes).filter((mesh) => mesh.pass.visible != null);
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

  /**
   * The sprite pool of the geometry — `undefined` once disposed. Under `grow` a growth replaces it,
   * and the geometry with it: read both from the mesh afresh, a pool kept from before is disposed.
   */
  get spritePool(): VertexObjectPool<Api & VO> | undefined {
    return this.geometry?.instancedPool;
  }

  /**
   * Takes a sprite from the pool, at the values of an unused slot: 0 everywhere, white as its tint.
   * Answers `undefined` once the pool is full or the sprites are disposed. The first time the pool
   * is full it says so on the console, once per mesh, naming the capacity and how to raise it; a
   * disposed mesh answers without a word.
   *
   * Built with `grow: true`, a full pool grows instead: a geometry of twice the capacity takes the
   * place of the old one, on this mesh and on every pass mesh, every sprite moves over — the handles
   * stay the same objects in the same slots, with their values — and the old geometry is disposed.
   * The first growth says so on the console, once per mesh, with the capacity to start with.
   *
   * @throws under `grow`, for a geometry with pools attached (`attachInstancedPool()`), which a grown
   *   geometry would leave behind, and for a geometry slot that holds another geometry than the one
   *   the sprites built, which is not theirs to replace; nothing has changed then
   */
  createSprite(): (Api & VO) | undefined {
    const pool = this.geometry?.instancedPool;
    if (pool == null) return undefined;
    const sprite = pool.createVO();
    if (sprite !== undefined) return sprite;
    if (this.#grows) return this.#grow(pool.capacity).instancedPool.createVO();
    if (!this.#warnedFull) this.#warnFull(pool.capacity);
    return undefined;
  }

  // builds the grown geometry before anything switches, so that a throw leaves the sprites as they were
  #grow(capacity: number): FeatureSpritesGeometry<Api> {
    const old = this.geometry!;
    if (old !== this.#builtGeometry) {
      throw new Error(
        `${WHERE}#createSprite(): the pool is full and cannot grow — the geometry slot holds a geometry the sprites did not build, and grow replaces only their own. Put the geometry the sprites built back into the slot, or build the sprites with the capacity they need`,
      );
    }
    if (old.extraInstancedPools.size > 0) {
      throw new Error(
        `${WHERE}#createSprite(): the pool is full and cannot grow — the geometry of the sprites has pools attached (attachInstancedPool()), which a grown geometry would leave behind. Detach them, or build the sprites without grow and with the capacity they need`,
      );
    }
    const larger = Math.max(2 * capacity, 1);
    const grown = old.grown(larger);
    // three's render objects see a geometry of another id on the next frame and collect its
    // attributes anew; the materials never held the geometry and stay as they are. Writing the slot
    // takes every pass mesh along
    this.geometry = grown;
    this.#builtGeometry = grown;
    // built here, so it is this mesh's to release; its pool goes with it, holding no sprite any more
    old.dispose();
    if (!this.#notedGrowth) {
      this.#notedGrowth = true;
      // biome-ignore lint/suspicious/noConsole: the note to the developer is the point
      console.info(
        `FeatureSprites "${this.name}": the pool was full at ${capacity} sprites and grew to ${larger} — a frame hitch: a new geometry, every sprite copied over and every attribute uploaded anew. Where this many sprites are the rule, start with new FeatureSprites(kind, {capacity: ${larger}, grow: true}). This note is shown once per FeatureSprites.`,
      );
    }
    return grown;
  }

  #warnFull(capacity: number): void {
    this.#warnedFull = true;
    const larger = Math.max(2 * capacity, 1);
    // the geometry in the slot is the full one — built, handed in or put there by the caller; only the
    // built one grows with the capacity of the sprites
    const fix =
      this.geometry === this.#builtGeometry
        ? `Give the sprites a larger capacity — new FeatureSprites(kind, {capacity: ${larger}})`
        : `Build the FeatureSpritesGeometry in the geometry slot with a larger capacity — new FeatureSpritesGeometry(kind, {capacity: ${larger}})`;
    // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
    console.warn(
      `FeatureSprites "${this.name}": the pool is full — all ${capacity} sprites are in use, so createSprite() answers undefined. ${fix} — or free the sprites no longer drawn with freeSprite(). This warning is shown once per FeatureSprites.`,
    );
  }

  // the geometry in the slot is the geometry of the sprites: the mesh and every pass mesh draw it,
  // and createSprite(), freeSprite(), sortBy(), sortByViewDepth() and spritePool work on its pool
  #putGeometry(geometry: FeatureSpritesGeometry<Api> | undefined): void {
    this.#slotGeometry = geometry;
    for (const mesh of Object.values(this.#passes)) {
      // undefined only while the slot is empty, when the mesh itself cannot be drawn either
      mesh.geometry = geometry as FeatureSpritesGeometry<Api>;
    }
  }

  /** Gives a sprite back; the last sprite moves into its slot. Does nothing once disposed. */
  freeSprite(sprite: VO): void {
    this.geometry?.instancedPool.freeVO(sprite);
  }

  /**
   * Puts the sprites into a draw order: by a number property of their handle (`'y'`, `'z'`,
   * `'rotation'` …), or by a function of the sprite. Stable — sprites of the same key keep their
   * order —, the lowest key first unless `descending`, a `NaN` key last. The passes draw the
   * geometry of the sprites, so they draw in the same order. See `VertexObjectPool#sortBy`, which
   * this is, for what moves, what is refused and what a key function costs.
   *
   * Sort after the sprites are written and before {@link update}: the sort marks the sprites that
   * moved for upload, all of their attributes — a mesh sorted every frame whose order changes uploads
   * about every attribute every frame. Allocates nothing once its scratch is there.
   *
   * @returns whether a sprite moved; `false` once disposed
   */
  sortBy(key: SpriteSortKeyName<Api> | ((sprite: Api & VO) => number), options?: VOSortOptions): boolean {
    const pool = this.geometry?.instancedPool;
    if (pool == null) return false;
    return pool.sortBy(key as VOSortKeyName<Api & VO> | VOSortKey<Api & VO>, options);
  }

  /**
   * Puts the sprites into the order `camera` sees them back to front: by the depth of their
   * `instancePosition` in view space, the farthest first — the order transparent billboards and
   * sprite clouds blend right in. The depth is taken at the position of a sprite, the centre of its
   * quad, through the world matrices of this mesh and of the camera, which it refreshes. Perspective
   * and orthographic cameras alike.
   *
   * Everything else is {@link sortBy}: stable, the passes follow, call it before {@link update}.
   * Allocates nothing once its scratch is there.
   *
   * @returns whether a sprite moved; `false` once disposed and with fewer than two sprites
   * @throws for a kind without the attribute `instancePosition`, which every built-in placement
   *   requires — only a kind with a placement of its own meets it
   */
  sortByViewDepth(camera: Camera): boolean {
    const pool = this.geometry?.instancedPool;
    if (pool == null) return false;

    const layout = pool.buffer.bufferAttributes.get('instancePosition');
    if (layout === undefined) {
      throw new Error(
        `${WHERE}#sortByViewDepth(): the sprites of this kind have no instancePosition to measure the view depth at — add InstancePosition to the features of the kind, or sort by a key of your own with sortBy()`,
      );
    }
    const n = pool.usedCount;
    if (n < 2) return false;

    // the renderer writes the modelViewMatrix of the mesh only inside render(), after update(), so the
    // product is built here, from world matrices refreshed as update() refreshes its own
    this.updateWorldMatrix(true, false);
    camera.updateWorldMatrix(true, false);
    const m = this.#modelView.multiplyMatrices(camera.matrixWorldInverse, this.matrixWorld).elements;
    // the third row: the z of a position in view space. three looks along -z, so the farthest sprite
    // has the lowest z, and the ascending sort draws it first
    const m2 = m[2]!;
    const m6 = m[6]!;
    const m10 = m[10]!;
    const m14 = m[14]!;

    // the depth goes straight into the sort scratch of the pool
    const keys = pool.prepareSortKeys();

    // straight from the buffer, as a sort by a value property reads it: no value crosses a call
    const record = pool.buffer.buffers.get(layout.bufferName)!;
    const positions = record.typedArray!;
    const stride = pool.descriptor.vertexCount * record.itemSize;
    const {offset} = layout;
    for (let i = 0; i < n; i++) {
      const p = i * stride + offset;
      keys[i] = m2 * positions[p]! + m6 * positions[p + 1]! + m10 * positions[p + 2]! + m14;
    }

    return pool.sortByPreparedKeys();
  }

  /** The placement of the material of the sprites — `undefined` once disposed. */
  get placement(): SpriteFeature | undefined {
    return this.#material?.placement;
  }

  /**
   * Swaps the placement of the material and of every pass material that draws with the placement
   * of the sprites — a pass that brings its own keeps it; see {@link FeatureSpritesMaterial.placement}.
   * Once disposed it turns away what it turns away otherwise — a feature that is malformed, one
   * that cannot stand in for the placement of the kind — and changes nothing.
   *
   * @throws a `TypeError` for a feature that is malformed — see `defineFeature()` —, a `TypeError`
   *   naming both features for a placement that cannot stand in, an `Error` for a placement whose
   *   `checkKind` refuses the kind or that a pass cannot draw next to — the rules of
   *   {@link FeatureSpritesMaterial.placement} —, and what the material throws for a placement it
   *   refuses; every material keeps its placement then
   */
  set placement(feature: SpriteFeature) {
    checkFeature(feature, WHERE);
    // the rules of a stand-in hang on the kind alone, which dispose() leaves standing, so the setter
    // turns a placement away after it as well; the material checks once more below, since it is a
    // public class with a setter of its own
    const kindPlacement = this.kind.pipeline.placement!;
    checkPlacementStandIn(this.kind, kindPlacement, this.#material?.placement ?? kindPlacement, feature, WHERE);
    if (this.#material == null) return;
    // every pass checks the placement against its features before any material takes it; then the
    // material checks it, and the pass materials take what the material took
    for (const mesh of Object.values(this.#passes)) checkPassFeatures(this.kind, mesh.pass, feature, WHERE);
    this.#material.placement = feature;
    for (const mesh of Object.values(this.#passes)) {
      if (placementOfPass(mesh.pass) == null) mesh.material.placement = feature;
    }
  }

  /** The uniforms of the material of the sprites — `undefined` once disposed. */
  get uniforms(): Readonly<Record<string, SpriteUniformNode>> | undefined {
    return this.#material?.uniforms;
  }

  /**
   * Writes a uniform the sprites and every pass read; see {@link FeatureSpritesMaterial.setUniform}.
   * Does nothing once disposed.
   */
  setUniform(name: string, x: number, y?: number, z?: number, w?: number): void {
    this.#material?.setUniform(name, x, y, z, w);
  }

  /**
   * Binds the uniform `name` to `source`: every {@link update} writes it, in the local space of the
   * sprites, for the sprites and every pass. A binding of the same name is replaced and keeps its
   * place; bindings run in the order they were made. A `setUniform()` on a bound name holds until
   * the next `update()`. The nodes a source reads stay the caller's. Once disposed it turns away
   * something that is no source and binds nothing.
   *
   * @throws a `TypeError` for a name no feature of the sprites or their passes declares, for a
   *   source of another type than the uniform, and for something that is no source; nothing is
   *   bound then
   */
  bindUniform(name: string, source: SpriteUniformSource): void {
    if (source == null || typeof source.write !== 'function' || (source.type !== 'vec3' && source.type !== 'vec4')) {
      throw new TypeError(
        `${WHERE}: bindUniform("${name}") takes a source with a type of vec3 or vec4 and a write(), got ${describeValue(source)}`,
      );
    }
    const material = this.#material;
    // name and type of the uniform are not judged once disposed: the uniforms went with the material
    if (material == null) return;
    // an own entry only: a name such as "constructor" is no uniform
    const node = Object.hasOwn(material.uniforms, name) ? material.uniforms[name] : undefined;
    if (node == null) {
      throw new TypeError(`${WHERE}: no feature of these sprites or their passes declares the uniform "${name}"`);
    }
    const {value} = node;
    let binding: UniformBinding;
    if (source.type === 'vec3' && value instanceof Vector3) binding = {type: 'vec3', name, source, vector: value};
    else if (source.type === 'vec4' && value instanceof Vector4) binding = {type: 'vec4', name, source, vector: value};
    else
      throw new TypeError(
        `${WHERE}: the uniform "${name}" is a ${typeOfUniform(node)}, and the source bound to it writes a ${source.type}`,
      );
    const at = this.#bindings.findIndex((bound) => bound.name === name);
    if (at === -1) this.#bindings.push(binding);
    else this.#bindings[at] = binding;
  }

  /** Ends the binding of `name`; the uniform keeps the value written last. Does nothing without one. */
  unbindUniform(name: string): void {
    const at = this.#bindings.findIndex((bound) => bound.name === name);
    if (at === -1) return;
    this.#bindings.splice(at, 1);
  }

  /** The texture `name` — `undefined` while it is unset, and once disposed. */
  getTexture(name: string): Texture | undefined {
    return this.#material?.getTexture(name);
  }

  /**
   * Sets the texture `name` for the sprites and every pass; it stays the caller's. See
   * {@link FeatureSpritesMaterial.setTexture}. Does nothing once disposed.
   */
  setTexture(name: string, texture: Texture | undefined): void {
    this.#material?.setTexture(name, texture);
  }

  /**
   * Re-reads the texture `name` once a loader filled in its image, or its filters, `colorSpace`,
   * `type` or `format` changed; see {@link FeatureSpritesMaterial.touchTexture}. Does nothing once
   * disposed.
   */
  touchTexture(name: string): void {
    this.#material?.touchTexture(name);
  }

  /**
   * Writes the bound uniforms (see {@link bindUniform}), judges the `visible` hook of every pass
   * that has one, then uploads what the pools have marked — see {@link VertexObjects.update}. Call
   * it once per frame, after the changes and before rendering: it refreshes the world matrices it
   * reads, so a node moved after it shows up a frame late. Allocates nothing.
   *
   * A source or a hook that throws stops neither the others nor the upload: once the upload is done,
   * `update()` throws what it threw as an `Error` that names the uniform of the source or the pass of
   * the hook — `FeatureSprites: the visible of pass "shadow" threw: …` —, and several as an
   * `AggregateError`. A pass whose hook threw keeps the visibility of its last judgement.
   */
  override update(): void {
    let errors: unknown[] | undefined;
    const bindings = this.#bindings;
    if (bindings.length > 0 && this.#material != null) {
      // the renderer refreshes the world matrices only inside render(), after this call
      this.updateWorldMatrix(true, false);
      const worldToSprites = this.#worldToSprites.copy(this.matrixWorld).invert();
      for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i]!;
        try {
          if (binding.type === 'vec3') binding.source.write(binding.vector, worldToSprites);
          else binding.source.write(binding.vector, worldToSprites);
        } catch (error) {
          (errors ??= []).push(callerError(`${WHERE}: the source bound to the uniform "${binding.name}"`, error));
        }
      }
    }
    const judged = this.#judgedPasses;
    for (let i = 0; i < judged.length; i++) {
      try {
        judged[i]!.judgeVisibility();
      } catch (error) {
        (errors ??= []).push(error);
      }
    }
    // the upload reads neither the bindings nor the hooks: what threw above keeps no sprite of this
    // frame from the gpu
    super.update();
    if (errors !== undefined) throwCollected(errors, `${WHERE}#update(): more than one bound source or visible hook threw`);
  }

  /**
   * Releases the geometry and the material this mesh built — also when another has taken their
   * slot; what the caller put into a slot stays the caller's — the pass meshes with their materials
   * and the uniforms and textures they shared, and drops every binding, so that the sprites hold no
   * node after it. The mesh leaves the scene graph first and fires three's `dispose` event, so the
   * renderer drops what it built for it; every pass mesh leaves this mesh and fires the event as
   * well. Afterwards `geometry`, `material`, `spritePool`, `placement` and `uniforms` answer
   * `undefined`, and so do `createSprite()` and `getTexture()`; `passes` is empty; `freeSprite()`,
   * `setUniform()`, `unbindUniform()`, `setTexture()`, `touchTexture()` and `update()` do nothing,
   * `sortBy()` and `sortByViewDepth()` answer `false`. `bindUniform()` binds nothing and still turns
   * away something that is no source, and the `placement` setter changes nothing and still turns
   * away a feature that is malformed or cannot stand in. A second call does nothing.
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
    this.#judgedPasses = [];
    this.#bindings.length = 0;

    // what was built here goes, whatever stands in its slot; what stands in a slot without being built
    // here is let go of, not disposed
    this.#builtGeometry?.dispose();
    this.#builtGeometry = undefined;
    this.geometry = undefined;

    if (this.#ownsMaterial) this.#material?.dispose();
    this.#material = undefined;
    this.material = undefined;

    // the materials borrowed the resources; they go after every material that read them
    this.#resources?.dispose();
    this.#resources = undefined;
  }
}
