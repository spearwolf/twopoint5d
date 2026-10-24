import {add, float, instanceIndex, uniform, vec4} from 'three/tsl';
import {
  Camera,
  Color,
  FloatType,
  Matrix4,
  Mesh,
  type MRTNode,
  NoBlending,
  type Node,
  type Object3D,
  type Renderer,
  RenderTarget,
  Scene,
  type TypedArray,
  type UniformNode,
  Vector2,
  WebGLCoordinateSystem,
} from 'three/webgpu';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import type {VO} from '../vertex-objects/types.js';
import type {VertexObjectPool} from '../vertex-objects/VertexObjectPool.js';
import {FeatureSprites} from './FeatureSprites/FeatureSprites.js';
import type {FeatureSpritesGeometry} from './FeatureSprites/FeatureSpritesGeometry.js';
import {FeatureSpritesMaterial} from './FeatureSprites/FeatureSpritesMaterial.js';

/** What {@link SpritePicker.pick} found under the pointer. */
export interface SpritePick<Api extends object = object> {
  /** The mesh the sprite belongs to — one of those handed to `pick()`. */
  readonly sprites: FeatureSprites<Api>;
  /** The handle of the sprite, as it was drawn under the pointer. */
  readonly sprite: Api & VO;
  /**
   * The slot the sprite was drawn from. A sort, a `freeSprite()` or a growth may have moved it since
   * the draw; the handle stays right — read the slot afresh from it where it matters.
   */
  readonly index: number;
}

/** The pick of one of the meshes `S`: over a list of meshes of several kinds, a union of their picks. */
export type SpritePickOf<S> = S extends FeatureSprites<infer Api> ? SpritePick<Api> : never;

/** A point of the view in normalized device coordinates: `x` and `y` from -1 to 1, `y` up. */
export interface PickPointer {
  readonly x: number;
  readonly y: number;
}

// the fields of a material that decide which fragments a sprite draws, copied to its pick material
const DRAWN_FRAGMENTS = [
  'side',
  'alphaTest',
  'alphaTestNode',
  'opacity',
  'opacityNode',
  'maskNode',
  'alphaHash',
  'alphaToCoverage',
] as const;

// a float names every whole number up to 2^24 exactly, and the target holds the slot + 1
const MAX_SPRITES_PER_MESH = 2 ** 24;

const WHERE = 'SpritePicker#pick()';

// three's projection for a reversed depth buffer is the plain one with its depth row turned over:
// z' = w - z from the 0 … 1 of WebGPU, z' = (w - z) / 2 from the -1 … 1 of WebGL — the near plane
// at 1, the far plane at 0 (three 0.186.1, Matrix4#makePerspective() and #makeOrthographic())
// biome-ignore format: the matrix row by row
const REVERSE_DEPTH_WEBGPU = new Matrix4().set(
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, -1, 1,
  0, 0, 0, 1,
);
// biome-ignore format: the matrix row by row
const REVERSE_DEPTH_WEBGL = new Matrix4().set(
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, -0.5, 0.5,
  0, 0, 0, 1,
);

interface PickEntry {
  readonly mesh: Mesh;
  readonly material: FeatureSpritesMaterial;
  /** The geometry of the sprites the pick mesh is built on and draws. */
  readonly geometry: FeatureSpritesGeometry;
  /** The place of the mesh in the list of a pick, from 1: what the green of the target says. */
  readonly meshNumber: UniformNode<'float', number>;
  /** Releases the entry; it listens to the sprites and to {@link geometry}. */
  readonly onDispose: () => void;
}

/** A mesh drawn by a pick, and its handles as they stood at the draw. */
interface Drawn {
  readonly sprites: FeatureSprites;
  /** The pool the mesh was drawn from. */
  readonly pool: VertexObjectPool<object & VO>;
  /** The `slotMoves` of {@link pool} at the draw. */
  readonly slotMoves: number;
  readonly handles: ((object & VO) | undefined)[];
}

/**
 * The camera of a pick: the view of the camera picked through and a projection onto one pixel. The
 * renderer asks a camera of another coordinate system or depth convention than its own to update
 * its projection; this one carries the projection it is handed, so there is nothing to update.
 */
class PickCamera extends Camera {
  updateProjectionMatrix(): void {}
}

const hasProjectionUpdate = (camera: Camera): camera is Camera & {updateProjectionMatrix(): void} =>
  typeof (camera as {updateProjectionMatrix?: unknown}).updateProjectionMatrix === 'function';

// three draws an object only while it and every ancestor is visible — and none whose material is
// not visible, which #gather() asks beside it
function isShown(object: Object3D): boolean {
  for (let node: Object3D | null = object; node != null; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

/**
 * Picks the sprite under the pointer on the gpu: it draws the meshes it is handed into one pixel
 * under the pointer, each sprite writing its slot and the place of its mesh in the list instead of a
 * color, and reads the pixel back. Every sprite draws through its own graph — placement, frame, uv
 * and color stages —, so the pick lands where the sprite is drawn, rotated, billboarded, trimmed or
 * animated, and the alpha test of the sprite drops its transparent texels: a pick there lands on
 * what lies behind. The nearest sprite wins.
 *
 * The renderer stays the caller's; the picker owns its render target, and a pick material and a pick
 * mesh per mesh it has drawn, which go when that mesh is disposed, when the geometry they draw is
 * disposed — a growth does that —, or with {@link dispose}; the next pick of the mesh builds them
 * anew. Until then the picker holds the mesh, and with it its geometry, its pool and its textures,
 * whether a later pick lists it or not: a mesh taken out of the scene and never disposed lives as
 * long as the picker. Dispose a mesh that is done with, or the picker.
 */
export class SpritePicker {
  /** The renderer it draws with; it stays the caller's. */
  readonly renderer: Renderer;

  readonly #entries = new Map<FeatureSprites, PickEntry>();
  readonly #scene = new Scene();
  readonly #camera = new PickCamera();
  readonly #pixel = new Matrix4();
  readonly #size = new Vector2();
  readonly #clearColor = new Color();
  readonly #pending = new Set<(error: Error) => void>();
  // the arrays of handles of the picks that have resolved, for the next ones to fill
  readonly #spareHandles: ((object & VO) | undefined)[][] = [];
  #target: RenderTarget | undefined;
  #disposed = false;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.#scene.name = 'twopoint5d.SpritePicker';
    // the pick meshes carry the world matrices of their sprites, copied before every pick
    this.#scene.matrixWorldAutoUpdate = false;
    this.#camera.matrixAutoUpdate = false;
    this.#camera.matrixWorldAutoUpdate = false;
  }

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Draws `sprites` as `camera` sees them into the pixel under `pointer` and answers the sprite
   * nearest to the camera there — its mesh, its handle and the slot it was drawn from — or
   * `undefined` for nothing. The answer comes a frame later, once the gpu has drawn and the pixel is
   * read back; the handle is the one drawn under the pointer, whatever a sort or a growth has moved
   * since, and a sprite freed since answers `undefined`. A sprite without a handle — written into the
   * pool through `createFromAttributes()` — gets one when the pick hits it, as `getVO()` gives it,
   * and answers `undefined` when a sort, a free or a growth has moved the slots since the draw.
   *
   * Call it after the `update()` of the sprites, as the render: it draws what they uploaded. The
   * pointer and the list are taken as they are at the call; the camera is read at the draw: its
   * coordinate system is set to the renderer's, as its next render would, and its depth convention
   * is left alone — under a reversed depth buffer the pick turns its projection over itself. Only
   * the sprites are drawn, not their passes. A mesh that is disposed, not visible (or under a parent
   * that is not), whose material is not visible, or that holds no sprite is left out; a mesh listed
   * twice is drawn once, at its first place. A mesh drawn once is held until it or the picker is
   * disposed, also when no later pick lists it. A pointer outside the view answers `undefined` without
   * a draw. The state of the renderer the pick changes — render target, MRT, clear color, the
   * `autoClear` flags — is restored before it returns.
   *
   * @param pointer the point of the view of `camera` in normalized device coordinates, snapped to
   *   the centre of the pixel of the renderer's drawing buffer it lies in
   * @returns `undefined` once disposed
   * @throws (rejects with) a `TypeError` for a camera that is no three.js camera, a pointer whose `x`
   *   or `y` is no finite number, a list that is no array and an entry that is no `FeatureSprites`; a
   *   `RangeError` for a mesh of more than 2^24 sprites, whose slots the float target cannot name;
   *   an `Error` for a pick still in flight when the picker is disposed; and whatever the
   *   `onCreateVO` hook of the pool throws for a sprite without a handle
   */
  // FeatureSprites is invariant in its handle type — the onCreateVO hook of its pool takes one —, so
  // only `any` admits a list of meshes of several kinds
  // biome-ignore lint/suspicious/noExplicitAny: see above
  pick<const S extends readonly FeatureSprites<any>[]>(
    camera: Camera,
    pointer: PickPointer,
    sprites: S,
  ): Promise<SpritePickOf<S[number]> | undefined> {
    let at: PickPointer;
    try {
      at = checkArguments(camera, pointer, sprites);
    } catch (error) {
      return Promise.reject(error);
    }
    if (this.#disposed) return Promise.resolve(undefined);

    // taken now: a caller that reuses its list while the renderer initializes changes neither what is
    // drawn nor what checkArguments() has seen
    const list: FeatureSprites[] = [...sprites];

    return new Promise((resolve, reject) => {
      this.#pending.add(reject);
      this.#pick(camera, at, list).then(
        (hit) => {
          if (this.#pending.delete(reject)) resolve(hit as SpritePickOf<S[number]> | undefined);
        },
        (error: unknown) => {
          if (this.#pending.delete(reject)) reject(error);
        },
      );
    });
  }

  async #pick(camera: Camera, pointer: PickPointer, list: readonly FeatureSprites[]): Promise<SpritePick | undefined> {
    if (pointer.x < -1 || pointer.x > 1 || pointer.y < -1 || pointer.y > 1) return undefined;
    if (!this.renderer.initialized) await this.renderer.init();
    if (this.#disposed) return undefined;

    // from here on everything runs in one go, up to the read back
    const drawn: Drawn[] = [];
    try {
      // inside the try: a refusal halfway through the list gives back what the meshes before it took
      this.#gather(list, drawn);
      if (drawn.length === 0) return undefined;
      this.#aim(camera, pointer);
      const pixel = await this.#draw();
      return resolvePixel(pixel, drawn);
    } finally {
      for (const record of drawn) {
        // a list of holes: a mesh left out has no record
        if (record === undefined) continue;
        record.handles.length = 0;
        this.#spareHandles.push(record.handles);
      }
      this.#scene.clear();
    }
  }

  /** Fills `drawn` with the meshes to draw, by their place in the list; the pick meshes in the scene, synced. */
  #gather(list: readonly FeatureSprites[], drawn: Drawn[]): void {
    const scene = this.#scene;
    scene.clear();
    for (let k = 0; k < list.length; k++) {
      const sprites = list[k]!;
      const pool = sprites.spritePool;
      if (pool === undefined || pool.usedCount === 0 || !isShown(sprites) || sprites.material?.visible === false) continue;
      if (drawn.some((record) => record.sprites === sprites)) continue;
      // refused, not drawn: above it two slots read back as one, and the pick would name the wrong sprite
      if (pool.usedCount > MAX_SPRITES_PER_MESH) {
        throw new RangeError(
          `${WHERE}: the entry ${k} of the list holds ${pool.usedCount} sprites, and the float target names a slot exactly up to ${MAX_SPRITES_PER_MESH} — split the sprites into meshes of at most ${MAX_SPRITES_PER_MESH}`,
        );
      }
      const entry = this.#sync(sprites, k + 1);
      scene.add(entry.mesh);
      // in drawn before the copy: whatever throws from here on, the finally of #pick() gives the array back
      const record: Drawn = {sprites, pool, slotMoves: pool.slotMoves, handles: this.#spareHandles.pop() ?? []};
      drawn[k] = record;
      // the handles of every slot in use as they stand at the draw, copied without a look-up: the read
      // back resolves the slot here, before a sort, a freeSprite() or a growth can move it. A slot
      // without a handle stays empty and gets one only when the pick hits it
      pool.copyVOsInto(record.handles);
    }
  }

  #sync(sprites: FeatureSprites, meshNumber: number): PickEntry {
    // the mesh is not disposed — it has a pool —, so it has its material
    const material = sprites.material!;
    let entry = this.#entries.get(sprites);
    // a material swapped on the mesh reads other uniforms and textures, a geometry put into the slot is
    // another to draw: for either the pick mesh is built anew
    if (entry !== undefined && (entry.material.resources !== material.resources || entry.geometry !== sprites.geometry)) {
      this.#release(sprites, entry);
      entry = undefined;
    }
    entry ??= this.#build(sprites, material);

    const pickMaterial = entry.material;
    if (pickMaterial.placement !== material.placement) pickMaterial.placement = material.placement;
    const from = material as unknown as Record<string, unknown>;
    const to = pickMaterial as unknown as Record<string, unknown>;
    let changed = false;
    for (const key of DRAWN_FRAGMENTS) {
      if (to[key] !== from[key]) {
        to[key] = from[key];
        changed = true;
      }
    }
    if (changed) pickMaterial.needsUpdate = true;
    entry.meshNumber.value = meshNumber;

    const {mesh} = entry;
    sprites.updateWorldMatrix(true, false);
    mesh.matrixWorld.copy(sprites.matrixWorld);
    mesh.layers.mask = sprites.layers.mask;
    mesh.renderOrder = sprites.renderOrder;
    return entry;
  }

  #build(sprites: FeatureSprites, material: FeatureSpritesMaterial): PickEntry {
    const meshNumber = uniform(0) as unknown as UniformNode<'float', number>;
    const pickMaterial = new FeatureSpritesMaterial(sprites.kind, {
      name: 'twopoint5d.SpritePicker',
      resources: material.resources,
      placement: material.placement,
      blending: NoBlending,
      transparent: false,
      depthTest: true,
      depthWrite: true,
    });
    // three writes the output node after the color node, the opacity and the alpha test have run: a
    // fragment the alpha test of the sprite drops is dropped here too, and no stage can change the id
    pickMaterial.outputNode = vec4(add(float(instanceIndex), 1), meshNumber, 0, 1) as unknown as Node;

    const geometry = sprites.geometry!;
    const mesh = new Mesh(geometry, pickMaterial);
    mesh.name = 'twopoint5d.SpritePicker';
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;

    const entry: PickEntry = {
      mesh,
      material: pickMaterial,
      geometry,
      meshNumber,
      // three's dispose event comes before the sprites release their resources: the pick material goes first
      onDispose: () => this.#release(sprites, entry),
    };
    sprites.addEventListener('dispose', entry.onDispose);
    // a growth disposes the geometry the pick mesh draws; three's render object of the pick mesh would
    // hold it, typed arrays and all, up to the next pick of these sprites — the pick mesh and the pick
    // material go with it, and the next pick builds both on the new one
    geometry.addEventListener('dispose', entry.onDispose);
    this.#entries.set(sprites, entry);
    return entry;
  }

  #release(sprites: FeatureSprites, entry: PickEntry): void {
    sprites.removeEventListener('dispose', entry.onDispose);
    entry.geometry.removeEventListener('dispose', entry.onDispose);
    this.#entries.delete(sprites);
    entry.mesh.removeFromParent();
    // three's dispose event for the pick mesh, so the renderer drops its render objects
    entry.mesh.dispose();
    entry.material.dispose();
  }

  /** The camera of the pick: the view of `camera`, its projection onto the pixel under `pointer`. */
  #aim(camera: Camera, pointer: PickPointer): void {
    const {renderer} = this;
    // as the renderer prepares a camera before it draws, which it would do on its next render anyway
    if (camera.coordinateSystem !== renderer.coordinateSystem) {
      camera.coordinateSystem = renderer.coordinateSystem;
      if (hasProjectionUpdate(camera)) camera.updateProjectionMatrix();
    }
    camera.updateWorldMatrix(true, false);

    const pick = this.#camera;
    pick.coordinateSystem = renderer.coordinateSystem;
    pick.matrixWorld.copy(camera.matrixWorld);
    pick.matrixWorldInverse.copy(camera.matrixWorldInverse);
    pick.layers.mask = camera.layers.mask;

    // the pixel (i, j) of the drawing buffer the pointer lies in, its centre (cx, cy) in device
    // coordinates; the matrix blows that pixel up to the clip space of the one-pixel target
    const size = renderer.getDrawingBufferSize(this.#size);
    const w = Math.max(size.x, 1);
    const h = Math.max(size.y, 1);
    const i = Math.min(Math.floor(((pointer.x + 1) / 2) * w), w - 1);
    const j = Math.min(Math.floor(((pointer.y + 1) / 2) * h), h - 1);
    const cx = ((i + 0.5) / w) * 2 - 1;
    const cy = ((j + 0.5) / h) * 2 - 1;
    // biome-ignore format: the matrix row by row
    this.#pixel.set(
      w, 0, 0, -w * cx,
      0, h, 0, -h * cy,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    pick.projectionMatrix.multiplyMatrices(this.#pixel, camera.projectionMatrix);
    // three keeps the depth convention of a camera behind a getter and sets it inside render(): the
    // pick takes the projection the camera has and turns it to the reversed depth buffer itself,
    // and the caller's camera keeps its own
    if (renderer.reversedDepthBuffer && !camera.reversedDepth) {
      pick.projectionMatrix.premultiply(
        renderer.coordinateSystem === WebGLCoordinateSystem ? REVERSE_DEPTH_WEBGL : REVERSE_DEPTH_WEBGPU,
      );
    }
    pick.projectionMatrixInverse.copy(pick.projectionMatrix).invert();
  }

  /** Draws the scene of the pick into the target and asks for the pixel; the renderer as it was. */
  #draw(): Promise<TypedArray> {
    const {renderer} = this;
    // float, not integer: three 0.186.1 reads no integer target back under WebGL 2, and a float holds
    // every whole number up to 2^24 exactly
    const target = (this.#target ??= new RenderTarget(1, 1, {type: FloatType, depthBuffer: true}));

    const renderTarget = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace();
    const mipmapLevel = renderer.getActiveMipmapLevel();
    // three types the getter without the null it answers when no MRT is set
    const mrt = renderer.getMRT() as MRTNode | null;
    renderer.getClearColor(this.#clearColor);
    const clearAlpha = renderer.getClearAlpha();
    const {autoClear, autoClearColor, autoClearDepth, autoClearStencil} = renderer;
    try {
      renderer.setRenderTarget(target);
      // a global MRT would take the place of the output node in a render target
      renderer.setMRT(null);
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = true;
      renderer.autoClearColor = true;
      renderer.autoClearDepth = true;
      renderer.autoClearStencil = true;
      renderer.render(this.#scene, this.#camera);
      // asked before the first await: the copy is queued behind this draw, so two picks in flight
      // share the one target
      return renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1);
    } finally {
      renderer.setRenderTarget(renderTarget, cubeFace, mipmapLevel);
      renderer.setMRT(mrt);
      renderer.setClearColor(this.#clearColor, clearAlpha);
      renderer.autoClear = autoClear;
      renderer.autoClearColor = autoClearColor;
      renderer.autoClearDepth = autoClearDepth;
      renderer.autoClearStencil = autoClearStencil;
    }
  }

  /**
   * Releases the render target, every pick mesh and pick material, and stops listening to the meshes
   * it has drawn; the renderer and the meshes stay the caller's. Every pick still in flight is
   * rejected. Afterwards {@link pick} answers `undefined`. A second call does nothing.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    const error = new Error(`${WHERE}: the picker was disposed before the pick was read back`);
    for (const reject of this.#pending) reject(error);
    this.#pending.clear();

    for (const [sprites, entry] of [...this.#entries]) this.#release(sprites, entry);
    this.#scene.clear();
    this.#target?.dispose();
    this.#target = undefined;
    this.#spareHandles.length = 0;
  }
}

// checks the arguments of pick() and answers the pointer as a copy, its x and y read once: the check,
// the message and the pick see the same values
function checkArguments(camera: Camera, pointer: PickPointer, sprites: readonly unknown[]): PickPointer {
  if ((camera as {isCamera?: unknown} | null)?.isCamera !== true) {
    throw new TypeError(`${WHERE}: the camera is no three.js Camera, got ${describeThreeValue(camera, 'isObject3D')}`);
  }
  const x = pointer?.x;
  const y = pointer?.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    const got =
      typeof pointer !== 'object' || pointer === null
        ? describeValue(pointer)
        : `{x: ${describeValue(x)}, y: ${describeValue(y)}}`;
    throw new TypeError(`${WHERE}: the pointer is {x, y} in normalized device coordinates, -1 to 1 — got ${got}`);
  }
  if (!Array.isArray(sprites)) {
    throw new TypeError(
      `${WHERE}: takes a list of FeatureSprites, got ${describeThreeValue(sprites, 'isObject3D')} — pick(camera, pointer, [sprites])`,
    );
  }
  for (let k = 0; k < sprites.length; k++) {
    if (!(sprites[k] instanceof FeatureSprites)) {
      throw new TypeError(
        `${WHERE}: the entry ${k} of the list is no FeatureSprites, got ${describeThreeValue(sprites[k], 'isObject3D')} — the picker draws FeatureSprites alone`,
      );
    }
  }
  return {x, y};
}

// the red of the pixel is the slot + 1 (0: nothing), the green the place of the mesh in the list + 1
function resolvePixel(pixel: TypedArray, drawn: readonly Drawn[]): SpritePick | undefined {
  const slot = Math.round(pixel[0]!) - 1;
  const record = drawn[Math.round(pixel[1]!) - 1];
  // only a slot that was drawn
  if (slot < 0 || record === undefined || slot >= record.handles.length) return undefined;
  const pool = record.sprites.spritePool;
  let sprite = record.handles[slot];
  if (sprite === undefined) {
    // the slot held no handle at the draw — filled through createFromAttributes() —: it gets one
    // as getVO() gives it, as long as no sort, free or growth has moved the slots since
    if (pool !== record.pool || pool.slotMoves !== record.slotMoves) return undefined;
    sprite = pool.getVO(slot);
  }
  // a sprite freed since the draw is in the pool of its mesh no more
  if (sprite === undefined || pool?.containsVO(sprite) !== true) return undefined;
  return {sprites: record.sprites, sprite, index: slot};
}
