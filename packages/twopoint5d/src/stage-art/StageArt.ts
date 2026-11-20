import {Group, type Texture} from 'three/webgpu';

import {FeatureSprites} from '../sprites/FeatureSprites/FeatureSprites.js';
import {FeatureSpritesGeometry} from '../sprites/FeatureSprites/FeatureSpritesGeometry.js';
import type {FeatureSpritesMaterialParameters} from '../sprites/FeatureSprites/FeatureSpritesMaterial.js';
import type {PreparedSpriteFrame} from '../sprites/features/AtlasFrame.js';
import type {IProjection} from '../stage/IProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from '../stage/ProjectionPlane.js';
import {TextureAtlas} from '../texture/TextureAtlas.js';
import type {TextureStoreLease} from '../texture/TextureStore.js';
import {TextureStore} from '../texture/TextureStore.js';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {isObject} from '../utils/isObject.js';
import {isRecord} from '../utils/isRecord.js';
import type {VO} from '../vertex-objects/types.js';
import type {AttributeBuffer} from '../vertex-objects/VertexObjectBuffer.js';
import type {VertexObjectPool} from '../vertex-objects/VertexObjectPool.js';
import {VOUtils} from '../vertex-objects/VOUtils.js';
import {type ArtLayerInfo, type ArtLayer, ArtLayerInternals} from './ArtLayer.js';
import {type ArtFrame, anchorOf, artFrameOf, type LayerBox, layoutLayerInto, turnToPlane} from './artLayout.js';
import {
  type ArtPose,
  checkPoseField,
  ORDER_MAX,
  ORDER_MIN,
  POSE_DEG,
  POSE_DEPTH,
  POSE_FIELDS,
  POSE_FRAME,
  POSE_OPACITY,
  POSE_ORDER,
  POSE_SCALE_X,
  POSE_SCALE_Y,
  POSE_SIZE,
  POSE_VISIBLE,
  POSE_X,
  POSE_Y,
  refusePoseField,
  refuseUnknownPoseField,
} from './artPose.js';
import {
  type ArtLayerDef,
  type ArtLayerOptions,
  type ArtLayerSpec,
  checkArtSourceOptions,
  checkLayerDefs,
  prepareLayerFrame,
  readAtlasSource,
  readLooseLayers,
  type StageArtProblem,
} from './artSources.js';
import {type ArtTrack, fieldsOfTrack} from './artTrack.js';
import {type StageArtSpriteApi, stageArtKind} from './stageArtKind.js';

/**
 * Where an art takes its layers from (§3.2 of the proposal): an atlas item of a `TextureStore` —
 * an Aseprite sheet with split layers or a trimmed atlas —, or the same, already loaded, as an
 * atlas and its texture. With `layers` the layers are loose: each takes the frames and the place
 * its definition gives it. The art may be handed a promise of a source as well.
 */
export type StageArtSource =
  | {readonly store: TextureStore; readonly id: string; readonly layers?: readonly ArtLayerDef[]}
  | {readonly atlas: TextureAtlas<unknown>; readonly texture: Texture; readonly layers?: readonly ArtLayerDef[]};

/** The options of a {@link StageArt}. Every field is optional. */
export interface StageArtOptions {
  /** The name the messages of the art give it: `StageArt "kitchen": …`. */
  name?: string;
  /** Artwork pixels per unit of the stage. Default 1. */
  pxPerUnit?: number;
  /** The point of the canvas that lands on the origin of the art. Default the middle of the canvas, `[0, 0]` without one. */
  origin?: readonly [number, number];
  /** The point of the canvas the camera looks at in its rest, in artwork pixels. Default `origin`. */
  focus?: readonly [number, number];
  /** The projection of the stage — `stage.projection` —: its plane is the plane of the art. */
  projection?: IProjection;
  /** The plane of the art where the projection has none, or without a projection. Default `'xy|bottom-left'`. */
  plane?: ProjectionPlane | ProjectionPlaneDescription;
  /** Whether a layer at a depth is drawn as painted at the rest of a parallax camera. Default `true`. */
  compensateDepth?: boolean;
  /** The layers to take, in this stacking order, bottom first; a name the source lacks stays hidden. */
  only?: readonly string[];
  /** What code says about a layer that the picture cannot, by name. */
  layers?: Readonly<Record<string, ArtLayerOptions>>;
  /**
   * The parameters of the material of the mesh — `transparent` (default `true`), `depthWrite`
   * (default `false`), `depthTest`, `alphaTest`, … The textures and the placement are the art's own.
   */
  material?: Omit<FeatureSpritesMaterialParameters, 'textures' | 'placement' | 'resources' | 'pass'>;
}

// --- flags of a layer --------------------------------------------------------------------------

// a picture of the layer is there
const LOADED = 1;
// the load settled without a picture of the layer: a failed source, a layer the source lacks
const FAILED = 2;
// a depth at or in front of the camera leaves the layer undrawable
const BEHIND = 4;
// the art said that the layer, painted above another, lies behind it
const WARNED_ORDER = 16;
// the sprite of the layer is drawn: what its visible attribute holds
const SHOWN = 32;

// --- the fields of a pose as bits of a mask ------------------------------------------------------

const bit = (slot: number): number => 1 << slot;
const ALL_FIELDS = (1 << POSE_SIZE) - 1;
const MOVE = bit(POSE_X) | bit(POSE_Y) | bit(POSE_DEPTH);
const SCALE = bit(POSE_SCALE_X) | bit(POSE_SCALE_Y);
const LAYOUT = MOVE | SCALE | bit(POSE_DEG);
const STACK = bit(POSE_DEPTH) | bit(POSE_ORDER);

// an art holds at most this many layers: the index is the low part of artOrder, below 2^24 and so exact in a float32
const MAX_LAYERS = 8192;

const OPTION_KEYS: readonly (keyof StageArtOptions)[] = [
  'name',
  'pxPerUnit',
  'origin',
  'focus',
  'projection',
  'plane',
  'compensateDepth',
  'only',
  'layers',
  'material',
];
const OWN_MATERIAL_KEYS = ['textures', 'placement', 'resources', 'pass'] as const;
const PLANE_DESCRIPTIONS: readonly ProjectionPlaneDescription[] = [
  'xy|bottom-left',
  'xy|top-left',
  'xz|bottom-left',
  'xz|top-left',
];

// the scratch of a layout: what layoutLayerInto() writes, and the tuples the sprite setters copy from —
// a fraction in a typed array or a tuple stays unboxed, one handed to a call V8 leaves un-inlined is boxed
const layoutOut = new Float64Array(6);
const anchorOut = new Float64Array(2);
const positionTuple: [x: number, y: number, z: number] = [0, 0, 0];
const sizeTuple: [width: number, height: number] = [0, 0];
const anchorTuple: [anchorX: number, anchorY: number] = [0.5, 0.5];

// A scalar attribute of the sprites — rotation, fade —, written straight into its buffer at the slot of a
// sprite, as FeatureSprites#sortByViewDepth() reads one. Its accessor takes the value as an argument, and
// V8 boxes a fraction handed to an accessor it leaves un-inlined, which it decides anew with every
// deoptimization of the caller: one heap number per write. The record of the buffer stays for the life
// of its pool; its array is read at each write
interface ScalarAttribute {
  readonly record: AttributeBuffer;
  readonly stride: number;
  readonly offset: number;
}

function scalarAttributeOf(pool: VertexObjectPool<StageArtSpriteApi & VO>, name: string): ScalarAttribute {
  const layout = pool.buffer.bufferAttributes.get(name)!;
  const record = pool.buffer.buffers.get(layout.bufferName)!;
  return {record, stride: pool.descriptor.vertexCount * record.itemSize, offset: layout.offset};
}

// the pose apply() samples a track of another making into, one per track: a track writes the same fields
// at every time, so none of another track stays behind in it
const otherTrackPoses = new WeakMap<ArtTrack, ArtPose>();

const isPoseKey = (key: string): boolean => {
  switch (key) {
    case 'x':
    case 'y':
    case 'depth':
    case 'deg':
    case 'scaleX':
    case 'scaleY':
    case 'opacity':
    case 'frame':
    case 'visible':
    case 'order':
      return true;
    default:
      return false;
  }
};

const isProjection = (value: unknown): value is IProjection =>
  isObject(value) &&
  typeof value['updateViewRect'] === 'function' &&
  typeof value['getViewRect'] === 'function' &&
  typeof value['getScaleFactor'] === 'function' &&
  typeof value['createCamera'] === 'function' &&
  typeof value['updateCamera'] === 'function';

const isTexture = (value: unknown): value is Texture => isObject(value) && value['isTexture'] === true;

type SourceShape = 'store' | 'atlas' | 'promise';

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

function shapeOf(source: unknown): SourceShape | undefined {
  if (isObject(source) && typeof source['then'] === 'function') return 'promise';
  if (!isRecord(source)) return undefined;
  if (
    source['store'] instanceof TextureStore &&
    typeof source['id'] === 'string' &&
    hasOnlyKeys(source, ['store', 'id', 'layers'])
  ) {
    return 'store';
  }
  if (
    source['atlas'] instanceof TextureAtlas &&
    isTexture(source['texture']) &&
    hasOnlyKeys(source, ['atlas', 'texture', 'layers'])
  ) {
    return 'atlas';
  }
  return undefined;
}

const SHAPES = '{store, id} or {atlas, texture} — each with layers for loose layers —, or a promise of one';

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : describeValue(error));

const problemLine = ({layer, reason}: StageArtProblem): string =>
  `${layer === undefined ? 'the source' : `the layer ${describeValue(layer)}`}: ${reason}`;

/**
 * Art layers on a stage: the layers of a painted scene — read out of an Aseprite sheet, a trimmed
 * atlas or a list of loose props — drawn as one `FeatureSprites` in the plane of the stage, each at
 * the place it was painted at, posed in the units of the paint tool: artwork pixels and degrees
 * clockwise. Add it to the scene, set poses, and call {@link update} once per frame before the
 * render; {@link takeChanged} answers a frame step of a `FramePacer`.
 *
 * The art owns its mesh — the geometry and material it builds — and lets go of the lease it holds
 * on a store item in {@link dispose}; a store, an atlas, a texture, a projection and a plane handed
 * in stay the caller's.
 */
export class StageArt extends Group {
  /** The mesh the layers are drawn with; the art owns and disposes it. Hand it to a `SpritePicker`. */
  readonly mesh: FeatureSprites<StageArtSpriteApi>;
  /**
   * Resolves once every picture loaded or failed — at once for an atlas handed in —, and when the
   * art is disposed before. It never rejects: {@link problems} says what failed.
   */
  readonly loaded: Promise<void>;

  readonly #subject: string;
  readonly #options: StageArtOptions;
  readonly #projection: IProjection | undefined;
  readonly #plane: ProjectionPlane;
  #frame: ArtFrame | undefined;
  #canvas: {readonly width: number; readonly height: number} | undefined;
  #names: readonly string[] = Object.freeze([]);
  readonly #problems: StageArtProblem[] = [];
  #resolveLoaded!: () => void;
  #settled = false;
  #disposed = false;
  #lease: TextureStoreLease<unknown> | undefined;
  // the geometry the art put into the slot of its mesh for a source whose layers it did not know
  #geometry: FeatureSpritesGeometry<StageArtSpriteApi> | undefined;
  // the buffers of the rotation and the fade of the pool of the mesh, bound anew with its geometry
  #rotation: ScalarAttribute | undefined;
  #fade: ScalarAttribute | undefined;

  #layers: ArtLayer[] = [];
  readonly #byName = new Map<string, number>();
  readonly #bySprite = new Map<object, ArtLayer>();
  #subjects: string[] = [];
  #sprites: (StageArtSpriteApi & VO)[] = [];
  // per layer: the pose as written last, POSE_SIZE numbers a layer; the pose of the layout; the flags
  #poses = new Float64Array(0);
  #rests = new Float64Array(0);
  #flags = new Uint8Array(0);
  // per layer: the fields set before the load, which the layout of the load leaves alone
  #preset = new Uint16Array(0);
  #frameCounts = new Uint32Array(0);
  // per layer: the scale of a loose layer of a pxPerUnit of its own against the art's
  #sizeScales = new Float64Array(0);
  #prepared: (PreparedSpriteFrame | undefined)[][] = [];
  #boxes: LayerBox[] = [];
  #changed = false;
  #stackDirty = false;
  // a pose as set() reads it, one number per field, `visible` as 0 or 1
  readonly #row = new Float64Array(POSE_SIZE);
  // the pose apply() samples a track of artTrack() into: every field there from the start, each a
  // fraction where it can hold one, so that its shape and the representation of its fields stay
  readonly #trackPose: ArtPose = {
    x: 0.5,
    y: 0.5,
    depth: 0.5,
    deg: 0.5,
    scaleX: 0.5,
    scaleY: 0.5,
    opacity: 0.5,
    frame: 0,
    visible: true,
    order: 0,
  };
  static {
    ArtLayerInternals.set = (art, index, pose) => art.#set(index, pose);
    ArtLayerInternals.apply = (art, index, track, seconds) => art.#apply(index, track, seconds);
    ArtLayerInternals.reset = (art, index) => art.#reset(index);
  }

  /**
   * @param source - an atlas item of a store, an atlas and its texture, either with `layers` for
   *   loose layers, or a promise of one
   * @throws a `TypeError` or a `RangeError` — under `new StageArt()`, or `StageArt "<name>"` once the
   *   options name the art — for a source of none of the shapes, options that are no object or have
   *   a key no option has, a `name` that is no string, a `pxPerUnit` that is no finite number above
   *   0, an `origin` or `focus` that is no pair of finite numbers, a `compensateDepth` that is no
   *   boolean, a `projection` that is no `IProjection`, a `plane` that is neither a
   *   `ProjectionPlane` nor one of its four descriptions, `only` that names a layer twice, `layers`
   *   that is no object or holds options a layer cannot take, `only` or `layers` beside loose
   *   layers, loose layers that cannot be read, and `material` that is no object or sets what is
   *   the art's own. What the art cannot load or read out of its source is no refusal but a
   *   problem.
   */
  constructor(source: StageArtSource | Promise<StageArtSource>, options?: StageArtOptions) {
    super();
    this.name = 'twopoint5d.StageArt';
    if (options !== undefined && !isRecord(options)) {
      throw new TypeError(`new StageArt(): the options must be an object, got ${describeValue(options)}`);
    }
    const opts: StageArtOptions = options ?? {};
    const {name} = opts;
    if (name !== undefined && typeof name !== 'string') {
      throw new TypeError(`new StageArt(): name must be a string, got ${describeValue(name)}`);
    }
    this.#subject = name === undefined ? 'StageArt' : `StageArt ${describeValue(name)}`;
    const where = name === undefined ? 'new StageArt()' : this.#subject;
    for (const key of Object.keys(opts)) {
      if (!OPTION_KEYS.includes(key as keyof StageArtOptions)) {
        const known = OPTION_KEYS.map((option) => describeValue(option)).join(', ');
        throw new TypeError(`${where}: the options have no key ${describeValue(key)}; their keys are ${known}`);
      }
    }
    // checked here, worked out once the canvas is known
    artFrameOf(where, opts.pxPerUnit, opts.origin, opts.focus, undefined);
    if (opts.compensateDepth !== undefined && typeof opts.compensateDepth !== 'boolean') {
      throw new TypeError(`${where}: compensateDepth must be true or false, got ${describeValue(opts.compensateDepth)}`);
    }
    if (opts.projection !== undefined && !isProjection(opts.projection)) {
      throw new TypeError(
        `${where}: projection must be an IProjection — stage.projection —, got ${describeThreeValue(opts.projection, 'isObject3D')}`,
      );
    }
    const {plane} = opts;
    if (plane !== undefined && !(plane instanceof ProjectionPlane) && !PLANE_DESCRIPTIONS.includes(plane)) {
      throw new TypeError(
        `${where}: plane must be a ProjectionPlane or one of ${PLANE_DESCRIPTIONS.map((description) => describeValue(description)).join(', ')}, got ${describeThreeValue(plane, 'isPlane')}`,
      );
    }
    checkArtSourceOptions(where, {only: opts.only, layers: opts.layers});
    const material = opts.material;
    if (material !== undefined) {
      if (!isRecord(material)) throw new TypeError(`${where}: material must be an object, got ${describeValue(material)}`);
      for (const key of OWN_MATERIAL_KEYS) {
        if ((material as Record<string, unknown>)[key] !== undefined) {
          throw new TypeError(
            `${where}: material.${key} is the art's own — the art draws the frames of its source in the plane of the stage`,
          );
        }
      }
    }

    const shape = shapeOf(source);
    if (shape === undefined) throw new TypeError(`${where}: the source must be ${SHAPES}, got ${describeValue(source)}`);
    const loose = shape !== 'promise' ? (source as {layers?: unknown}).layers : undefined;
    if (loose !== undefined) {
      if (opts.only !== undefined || opts.layers !== undefined) {
        throw new TypeError(
          `${where}: a source of loose layers names its layers itself — give each its options in the layers list of the source, and leave out only and layers`,
        );
      }
      checkLayerDefs(where, loose);
    }

    this.#options = opts;
    this.#projection = opts.projection;
    const planeOfProjection = opts.projection?.projectionPlane;
    if (planeOfProjection !== undefined && plane !== undefined) {
      // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
      console.warn(
        `${this.#subject}: it was handed both a projection with a plane and a plane — it lies in the plane of the projection; leave out plane, or the projection. This warning is shown once per art.`,
      );
    }
    this.#plane = ProjectionPlane.get(planeOfProjection ?? plane ?? 'xy|bottom-left');

    // the layers known now: those of a source handed in, else those only names. A source loaded later
    // without only builds the geometry of its layers once they are known
    let read: {canvas: StageArt['canvas']; layers: ArtLayerSpec[]; problems: StageArtProblem[]} | undefined;
    if (shape === 'atlas') read = this.#read(source as Extract<StageArtSource, {atlas: unknown}>);
    const names = read?.layers.map((layer) => layer.name) ?? opts.only ?? [];
    if (opts.only !== undefined && opts.only.length > MAX_LAYERS) {
      throw new RangeError(`${where}: only names ${opts.only.length} layers, and an art holds at most ${MAX_LAYERS}`);
    }

    this.mesh = new FeatureSprites(stageArtKind([]), {
      capacity: Math.min(names.length, MAX_LAYERS),
      ...material,
      transparent: material?.transparent ?? true,
      depthWrite: material?.depthWrite ?? false,
    });
    this.mesh.name = 'twopoint5d.StageArt.mesh';
    this.#bindScalars();
    turnToPlane(this.mesh, this.#plane);
    this.add(this.mesh);

    this.loaded = new Promise<void>((resolve) => {
      this.#resolveLoaded = resolve;
    });

    if (read !== undefined) {
      this.#adopt(read, (source as {texture: Texture}).texture);
    } else {
      this.#createLayers(names);
      // loaded never rejects: what goes wrong past the checks of #load() is a problem of the source as well
      void this.#load(source as Promise<StageArtSource> | Extract<StageArtSource, {store: unknown}>).catch((error: unknown) =>
        this.#fail(`the art could not read its source: ${messageOf(error)}`),
      );
    }
  }

  /** The names of the layers, bottom first as painted — or as `only` names them. Empty until a source without `only` has loaded. */
  get names(): readonly string[] {
    return this.#names;
  }

  /** The canvas the layers were painted on, in artwork pixels; `undefined` for loose layers and until the source has loaded. */
  get canvas(): {readonly width: number; readonly height: number} | undefined {
    return this.#canvas;
  }

  /** What the art could not load or read out of its source; it says so on the console once, after the load. */
  get problems(): readonly StageArtProblem[] {
    return this.#problems;
  }

  /** The projection handed in. */
  get projection(): IProjection | undefined {
    return this.#projection;
  }

  /** The plane the art lies in: that of the projection, else the one handed in, else `'xy|bottom-left'`. */
  get plane(): ProjectionPlane {
    return this.#plane;
  }

  /** Whether {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * The handle of the layer `name` — the same object for the life of the art; a hot loop keeps it.
   *
   * @throws an `Error` for a name the art does not know, listing the names it knows, and once the
   *   art is disposed
   */
  layer(name: string): ArtLayer {
    if (this.#disposed) throw new Error(`${this.#subject}: layer() is not available: this art has been disposed`);
    const index = this.#byName.get(name);
    if (index === undefined) this.#refuseName(name);
    return this.#layers[index]!;
  }

  /** The layer of a sprite of the mesh — the `sprite` a `SpritePicker` answers —; `undefined` for another, and once disposed. */
  layerOf(sprite: object): ArtLayer | undefined {
    if (this.#disposed) return undefined;
    return this.#bySprite.get(sprite);
  }

  /**
   * Writes the fields of `pose` into the layer `name` and keeps the rest; a pose set before the
   * picture of the layer has arrived is kept and shown once it is there. Each field is checked
   * before any is written: a field that is no finite number, an `opacity` outside 0 … 1, a `frame`
   * that is no whole number of 0 or more — or, once the frames are known, no index into them —, an
   * `order` that is no whole number from -1024 to 1023, a `visible` that is no boolean and a key that
   * is no field of a pose throw, naming the layer and the field, and the layer keeps what it held.
   * Allocates nothing; does nothing once disposed.
   *
   * @throws an `Error` for a name the art does not know, listing the names
   */
  set(name: string, pose: ArtPose): void {
    if (this.#disposed) return;
    const index = this.#byName.get(name);
    if (index === undefined) this.#refuseName(name);
    this.#set(index, pose);
  }

  /**
   * Samples `track` at `seconds` into the layer `name`: `set()` with the pose the track shows then,
   * through a pose of the art's own, so a caller needs none. The fields the track does not have stay
   * as they are. Allocates nothing; does nothing once disposed.
   *
   * @throws an `Error` for a name the art does not know, a `TypeError` for a track that is no
   *   `ArtTrack`, what `ArtTrack#sample()` refuses of `seconds` and what `set()` refuses of the pose
   */
  apply(name: string, track: ArtTrack, seconds: number): void {
    if (this.#disposed) return;
    const index = this.#byName.get(name);
    if (index === undefined) this.#refuseName(name);
    this.#apply(index, track, seconds);
  }

  /** Puts every layer back to its rest; a layer that has not loaded forgets the fields set so far. Does nothing once disposed. */
  reset(): void {
    for (let i = 0; i < this.#layers.length; i++) this.#reset(i);
  }

  /**
   * Whether the picture changed since the last call, and starts over: `true` when a shown layer
   * changed a field of its pose to another value, turned from shown to hidden or back — by
   * `visible`, an `opacity` from or to 0, or its picture arriving — or changed its place in the
   * stack. A hidden layer that moves, and a value set again, answer `false`. A write through
   * `layer.sprite` is the caller's to report. `false` once disposed. Allocates nothing.
   */
  takeChanged(): boolean {
    const changed = this.#changed;
    this.#changed = false;
    return changed && !this.#disposed;
  }

  /**
   * Once per frame, before the render: sorts the layers back to front where a depth or an order
   * changed — by depth, the farthest first, then by order, then as painted — and updates the mesh.
   * The first update that finds a layer painted above another lying behind it says so on the
   * console, once per layer. Allocates nothing without a sort. Does nothing once disposed.
   */
  update(): void {
    if (this.#disposed) return;
    if (this.#stackDirty) {
      this.#stackDirty = false;
      // two stable passes: the second keeps the order of the first among layers of one depth, so the
      // stack is the same whatever the history of the sort
      this.mesh.sortBy('artOrder');
      this.mesh.sortBy('z');
      this.#warnPaintedBelow();
    }
    this.mesh.update();
  }

  /**
   * Leaves the parent, disposes the mesh — its geometry and material — and lets go of the lease of
   * a store item; a texture, an atlas, a store and a projection handed in stay the caller's. A load
   * still on its way is dropped when it lands, and {@link loaded} resolves. Afterwards `set()`,
   * `apply()`, `reset()` and `update()` do nothing, `takeChanged()` answers `false`, `layer()`
   * throws, `layerOf()` answers `undefined`; the getters answer what they held. A second call does
   * nothing.
   */
  override dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.removeFromParent();
    // three's dispose event first, while every part is still there; the group itself holds nothing on the gpu
    super.dispose();
    // the mesh leaves this group and gives up the geometry and material it built; the geometry the art
    // put into its slot is the art's, and goes after it
    this.mesh.dispose();
    this.#geometry?.dispose();
    this.#geometry = undefined;
    this.#lease?.release();
    this.#lease = undefined;
    this.#byName.clear();
    this.#bySprite.clear();
    this.#settled = true;
    this.#resolveLoaded();
  }

  // --- loading --------------------------------------------------------------------------------

  #read(source: {atlas: TextureAtlas<unknown>; layers?: readonly ArtLayerDef[]}): {
    canvas: StageArt['canvas'];
    layers: ArtLayerSpec[];
    problems: StageArtProblem[];
  } {
    if (source.layers !== undefined) return {canvas: undefined, ...readLooseLayers(this.#subject, source.atlas, source.layers)};
    const {only, layers} = this.#options;
    return readAtlasSource(this.#subject, source.atlas, {only, layers});
  }

  async #load(source: Promise<StageArtSource> | Extract<StageArtSource, {store: unknown}>): Promise<void> {
    let resolved: unknown = source;
    if (shapeOf(source) === 'promise') {
      try {
        resolved = await source;
      } catch (error) {
        if (!this.#disposed) this.#fail(`the source did not load: ${messageOf(error)}`);
        return;
      }
      if (this.#disposed) return;
      const shape = shapeOf(resolved);
      if (shape === undefined || shape === 'promise') {
        this.#fail(`the source the promise resolved with is none of the shapes ${SHAPES}: ${describeValue(resolved)}`);
        return;
      }
      const loose = (resolved as {layers?: unknown}).layers;
      if (loose !== undefined && (this.#options.only !== undefined || this.#options.layers !== undefined)) {
        this.#fail('the source the promise resolved with names loose layers, and the options name only or layers');
        return;
      }
    }

    let atlas: TextureAtlas<unknown>;
    let texture: Texture;
    if (shapeOf(resolved) === 'store') {
      const {store, id} = resolved as {store: TextureStore; id: string};
      let lease: TextureStoreLease<[TextureAtlas<unknown>, Texture]>;
      try {
        lease = await store.acquireAsync(id, ['atlas', 'texture']);
      } catch (error) {
        if (!this.#disposed) this.#fail(`the store item ${describeValue(id)} did not load: ${messageOf(error)}`);
        return;
      }
      if (this.#disposed) {
        lease.release();
        return;
      }
      this.#lease = lease;
      [atlas, texture] = lease.value;
    } else {
      ({atlas, texture} = resolved as {atlas: TextureAtlas<unknown>; texture: Texture});
    }
    const layers = (resolved as {layers?: readonly ArtLayerDef[]}).layers;
    this.#adopt(this.#read({atlas, layers}), texture);
  }

  // the source failed as a whole: every layer stays hidden, and one problem says why
  #fail(reason: string): void {
    if (this.#settled) return;
    this.#problems.push({layer: undefined, reason});
    for (let i = 0; i < this.#layers.length; i++) this.#flags[i]! |= FAILED;
    this.#finish();
  }

  #adopt(read: {canvas: StageArt['canvas']; layers: ArtLayerSpec[]; problems: StageArtProblem[]}, texture: Texture): void {
    let {layers} = read;
    this.#problems.push(...read.problems);
    if (layers.length > MAX_LAYERS) {
      this.#problems.push({
        layer: undefined,
        reason: `the source holds ${layers.length} layers, and an art holds at most ${MAX_LAYERS} — the art takes the first ${MAX_LAYERS}; split the scene into two arts`,
      });
      layers = layers.slice(0, MAX_LAYERS);
    }
    this.#canvas = read.canvas === undefined ? undefined : Object.freeze({width: read.canvas.width, height: read.canvas.height});
    const {pxPerUnit, origin, focus} = this.#options;
    this.#frame = artFrameOf(this.#subject, pxPerUnit, origin, focus, read.canvas);

    if (this.#layers.length === 0 && layers.length > 0) {
      // the layers were not known when the mesh was built: a geometry of as many slots takes the place of its empty one
      if (this.mesh.spritePool!.capacity < layers.length) {
        const geometry = new FeatureSpritesGeometry(this.mesh.kind, {capacity: layers.length});
        this.mesh.geometry = geometry;
        this.#geometry = geometry;
        this.#bindScalars();
      }
      this.#createLayers(layers.map((layer) => layer.name));
    }
    for (let i = 0; i < layers.length; i++) this.#settleLayer(i, layers[i]!);

    this.mesh.setTexture('colorMap', texture);
    this.#stackDirty = true;
    this.#finish();
  }

  #finish(): void {
    if (this.#settled) return;
    this.#settled = true;
    const problems = this.#problems;
    if (problems.length > 0) {
      const one = problems.length === 1;
      // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
      console.warn(
        `${this.#subject}: ${problems.length} problem${one ? '' : 's'} — art.problems lists ${one ? 'it' : 'them'}: ${problems.map(problemLine).join('; ')}`,
      );
    }
    this.#resolveLoaded();
  }

  #bindScalars(): void {
    const pool = this.mesh.spritePool!;
    this.#rotation = scalarAttributeOf(pool, 'rotation');
    this.#fade = scalarAttributeOf(pool, 'fade');
  }

  // the handles and sprites of the layers, hidden until their pictures arrive
  #createLayers(names: readonly string[]): void {
    const count = names.length;
    this.#names = Object.freeze([...names]);
    this.#poses = new Float64Array(count * POSE_SIZE);
    this.#rests = new Float64Array(count * POSE_SIZE);
    this.#flags = new Uint8Array(count);
    this.#preset = new Uint16Array(count);
    this.#frameCounts = new Uint32Array(count);
    this.#sizeScales = new Float64Array(count).fill(1);
    this.#prepared = names.map(() => []);
    this.#boxes = names.map(() => ({x: 0, y: 0, w: 0, h: 0}));
    this.#subjects = names.map((name) => `ArtLayer ${describeValue(name)}`);
    this.#sprites = [];
    this.#layers = [];
    for (let i = 0; i < count; i++) {
      const sprite = this.mesh.createSprite()!;
      sprite.visible = 0;
      sprite.artOrder = -ORDER_MIN * MAX_LAYERS + i;
      // a new sprite stands at the rest of a pose: scale 1, opacity 1, shown
      this.#poses[i * POSE_SIZE + POSE_SCALE_X] = 1;
      this.#poses[i * POSE_SIZE + POSE_SCALE_Y] = 1;
      this.#poses[i * POSE_SIZE + POSE_OPACITY] = 1;
      this.#poses[i * POSE_SIZE + POSE_VISIBLE] = 1;
      const layer = ArtLayerInternals.create(this, i, names[i]!, sprite);
      this.#sprites.push(sprite);
      this.#layers.push(layer);
      this.#byName.set(names[i]!, i);
      this.#bySprite.set(sprite, layer);
    }
  }

  // what the source says about the layer `index`: its frames, its box and its rest, under the fields
  // set before the load; then the whole sprite is written
  #settleLayer(index: number, spec: ArtLayerSpec): void {
    const frame = this.#frame!;
    const {box} = spec;
    const prepared = spec.frames.map((frameSpec) => (frameSpec === undefined ? undefined : prepareLayerFrame(frameSpec, box)));
    const frameCount = spec.frames.length;
    const loaded = prepared.some((entry) => entry !== undefined);
    this.#prepared[index] = prepared;
    this.#frameCounts[index] = frameCount;
    this.#boxes[index] = box;
    this.#sizeScales[index] = spec.pxPerUnit === undefined ? 1 : frame.pxPerUnit / spec.pxPerUnit;

    const at = index * POSE_SIZE;
    const rests = this.#rests;
    rests[at + POSE_X] = spec.pivotX;
    rests[at + POSE_Y] = spec.pivotY;
    rests[at + POSE_DEPTH] = spec.depth;
    rests[at + POSE_DEG] = 0;
    rests[at + POSE_SCALE_X] = 1;
    rests[at + POSE_SCALE_Y] = 1;
    rests[at + POSE_OPACITY] = 1;
    rests[at + POSE_FRAME] = 0;
    rests[at + POSE_VISIBLE] = 1;
    rests[at + POSE_ORDER] = spec.order;
    const name = spec.name;
    if (spec.rest !== undefined) {
      for (let slot = 0; slot < POSE_SIZE; slot++) {
        const value = spec.rest[POSE_FIELDS[slot]!];
        if (value !== undefined) rests[at + slot] = value === true ? 1 : value === false ? 0 : value;
      }
      if (frameCount > 0 && rests[at + POSE_FRAME]! >= frameCount) {
        this.#problems.push({
          layer: name,
          reason: `the frame ${rests[at + POSE_FRAME]} of its rest lies beyond its ${frameCount} frames — the layer rests at frame 0`,
        });
        rests[at + POSE_FRAME] = 0;
      }
    }

    const poses = this.#poses;
    const preset = this.#preset[index]!;
    for (let slot = 0; slot < POSE_SIZE; slot++) {
      if (!(preset & bit(slot))) poses[at + slot] = rests[at + slot]!;
    }
    this.#preset[index] = 0;
    if (frameCount > 0 && poses[at + POSE_FRAME]! >= frameCount) {
      this.#problems.push({
        layer: name,
        reason: `the frame ${poses[at + POSE_FRAME]} set before the layer loaded lies beyond its ${frameCount} frames — the layer shows frame 0`,
      });
      poses[at + POSE_FRAME] = 0;
    }

    const rest: Required<ArtPose> = {
      x: rests[at + POSE_X]!,
      y: rests[at + POSE_Y]!,
      depth: rests[at + POSE_DEPTH]!,
      deg: rests[at + POSE_DEG]!,
      scaleX: rests[at + POSE_SCALE_X]!,
      scaleY: rests[at + POSE_SCALE_Y]!,
      opacity: rests[at + POSE_OPACITY]!,
      frame: rests[at + POSE_FRAME]!,
      visible: rests[at + POSE_VISIBLE] !== 0,
      order: rests[at + POSE_ORDER]!,
    };
    const tagNames = Object.freeze([...spec.tags.keys()]);
    const info: ArtLayerInfo = Object.freeze({
      box: Object.freeze({x: box.x, y: box.y, w: box.w, h: box.h}),
      pivot: Object.freeze([spec.pivotX, spec.pivotY] as const),
      rest: Object.freeze(rest),
      frameCount,
      tags: spec.tags,
      tagNames,
      loaded,
    });
    ArtLayerInternals.adopt(this.#layers[index]!, info);

    this.#flags[index]! |= loaded ? LOADED : FAILED;
    const sprite = this.#sprites[index]!;
    // a box of no size — a layer without a picture — has no anchor in it
    if (box.w > 0 && box.h > 0) {
      anchorOf(box, spec.pivotX, spec.pivotY, anchorOut);
      anchorTuple[0] = anchorOut[0]!;
      anchorTuple[1] = anchorOut[1]!;
      sprite.setAnchor(anchorTuple);
    }
    if (loaded) this.#write(index, ALL_FIELDS);
    // every attribute of the sprite, the static ones too: the mesh may have been updated before
    this.mesh.spritePool?.touchVO(sprite);
  }

  // --- poses ----------------------------------------------------------------------------------

  // the checks stay inline — a value handed to a call V8 leaves un-inlined is boxed —, and a refusal
  // builds its message in checkPoseField() and refusePoseField(), which only a refusal calls
  #set(index: number, pose: ArtPose): void {
    if (this.#disposed) return;
    const subject = this.#subjects[index]!;
    if (typeof pose !== 'object' || pose === null) {
      throw new TypeError(`${subject}: the pose must be an object of the fields of an ArtPose, got ${describeValue(pose)}`);
    }
    for (const key in pose) if (!isPoseKey(key)) refuseUnknownPoseField(subject, 'the pose', key);
    const {x, y, depth, deg, scaleX, scaleY, opacity, frame, visible, order} = pose;
    if (x !== undefined && !(typeof x === 'number' && Number.isFinite(x))) checkPoseField(subject, 'x', x);
    if (y !== undefined && !(typeof y === 'number' && Number.isFinite(y))) checkPoseField(subject, 'y', y);
    if (depth !== undefined && !(typeof depth === 'number' && Number.isFinite(depth))) checkPoseField(subject, 'depth', depth);
    if (deg !== undefined && !(typeof deg === 'number' && Number.isFinite(deg))) checkPoseField(subject, 'deg', deg);
    if (scaleX !== undefined && !(typeof scaleX === 'number' && Number.isFinite(scaleX)))
      checkPoseField(subject, 'scaleX', scaleX);
    if (scaleY !== undefined && !(typeof scaleY === 'number' && Number.isFinite(scaleY)))
      checkPoseField(subject, 'scaleY', scaleY);
    if (opacity !== undefined && !(typeof opacity === 'number' && opacity >= 0 && opacity <= 1)) {
      checkPoseField(subject, 'opacity', opacity);
    }
    if (frame !== undefined) {
      if (!(typeof frame === 'number' && Number.isInteger(frame) && frame >= 0)) checkPoseField(subject, 'frame', frame);
      // before the frames are known, and for a layer without any, a frame is checked as a whole number alone
      const count = this.#frameCounts[index]!;
      if (count > 0 && frame >= count) this.#refuseFrame(index, frame, count);
    }
    if (visible !== undefined && typeof visible !== 'boolean') checkPoseField(subject, 'visible', visible);
    if (
      order !== undefined &&
      !(typeof order === 'number' && Number.isInteger(order) && order >= ORDER_MIN && order <= ORDER_MAX)
    ) {
      checkPoseField(subject, 'order', order);
    }

    const row = this.#row;
    let given = 0;
    if (x !== undefined) {
      row[POSE_X] = x;
      given |= bit(POSE_X);
    }
    if (y !== undefined) {
      row[POSE_Y] = y;
      given |= bit(POSE_Y);
    }
    if (depth !== undefined) {
      row[POSE_DEPTH] = depth;
      given |= bit(POSE_DEPTH);
    }
    if (deg !== undefined) {
      row[POSE_DEG] = deg;
      given |= bit(POSE_DEG);
    }
    if (scaleX !== undefined) {
      row[POSE_SCALE_X] = scaleX;
      given |= bit(POSE_SCALE_X);
    }
    if (scaleY !== undefined) {
      row[POSE_SCALE_Y] = scaleY;
      given |= bit(POSE_SCALE_Y);
    }
    if (opacity !== undefined) {
      row[POSE_OPACITY] = opacity;
      given |= bit(POSE_OPACITY);
    }
    if (frame !== undefined) {
      row[POSE_FRAME] = frame;
      given |= bit(POSE_FRAME);
    }
    if (visible !== undefined) {
      row[POSE_VISIBLE] = visible ? 1 : 0;
      given |= bit(POSE_VISIBLE);
    }
    if (order !== undefined) {
      row[POSE_ORDER] = order;
      given |= bit(POSE_ORDER);
    }
    this.#commit(index, given);
  }

  #apply(index: number, track: ArtTrack, seconds: number): void {
    if (this.#disposed) return;
    if (typeof track !== 'object' || track === null || typeof track.sample !== 'function') {
      throw new TypeError(
        `${this.#subjects[index]}: apply() takes an ArtTrack — artTrack(keys) builds one —, got ${describeValue(track)}`,
      );
    }
    const fields = fieldsOfTrack(track);
    if (fields === undefined) {
      // a track of another making: a pose of its own, read as any pose
      let pose = otherTrackPoses.get(track);
      if (pose === undefined) otherTrackPoses.set(track, (pose = {}));
      this.#set(index, track.sample(seconds, pose));
      return;
    }
    // a track of artTrack() writes the fields it has, checked as set() checks them, save the frame count:
    // read out of the one pose of the art, whose shape never changes, a fraction stays unboxed — read
    // where poses of many shapes pass, it is boxed
    const pose = this.#trackPose;
    track.sample(seconds, pose);
    const row = this.#row;
    if (fields & bit(POSE_X)) row[POSE_X] = pose.x!;
    if (fields & bit(POSE_Y)) row[POSE_Y] = pose.y!;
    if (fields & bit(POSE_DEPTH)) row[POSE_DEPTH] = pose.depth!;
    if (fields & bit(POSE_DEG)) row[POSE_DEG] = pose.deg!;
    if (fields & bit(POSE_SCALE_X)) row[POSE_SCALE_X] = pose.scaleX!;
    if (fields & bit(POSE_SCALE_Y)) row[POSE_SCALE_Y] = pose.scaleY!;
    if (fields & bit(POSE_OPACITY)) row[POSE_OPACITY] = pose.opacity!;
    if (fields & bit(POSE_VISIBLE)) row[POSE_VISIBLE] = pose.visible ? 1 : 0;
    if (fields & bit(POSE_ORDER)) row[POSE_ORDER] = pose.order!;
    if (fields & bit(POSE_FRAME)) {
      const frame = pose.frame!;
      const count = this.#frameCounts[index]!;
      if (count > 0 && frame >= count) this.#refuseFrame(index, frame, count);
      row[POSE_FRAME] = frame;
    }
    this.#commit(index, fields);
  }

  // takes the fields `given` of the row into the pose of the layer, and writes what changed
  #commit(index: number, given: number): void {
    const at = index * POSE_SIZE;
    const poses = this.#poses;
    const row = this.#row;
    let changed = 0;
    for (let slot = 0; slot < POSE_SIZE; slot++) {
      if (given & bit(slot) && poses[at + slot] !== row[slot]) {
        poses[at + slot] = row[slot]!;
        changed |= bit(slot);
      }
    }
    const flags = this.#flags[index]!;
    if (flags & LOADED) {
      this.#write(index, changed);
    } else if (!(flags & FAILED)) {
      // before the load: the layout of the load leaves these fields alone
      this.#preset[index]! |= given;
    }
  }

  #refuseFrame(index: number, frame: number, count: number): never {
    refusePoseField(
      this.#subjects[index]!,
      'frame',
      frame,
      `a whole number from 0 to ${count - 1}, an index into the ${count} frames of the layer`,
    );
  }

  #reset(index: number): void {
    if (this.#disposed) return;
    const flags = this.#flags[index]!;
    if (!(flags & (LOADED | FAILED))) {
      // the rest is not known before the load: the fields set so far are forgotten
      this.#preset[index] = 0;
      return;
    }
    const at = index * POSE_SIZE;
    const poses = this.#poses;
    const rests = this.#rests;
    let changed = 0;
    for (let slot = 0; slot < POSE_SIZE; slot++) {
      if (poses[at + slot] !== rests[at + slot]) {
        poses[at + slot] = rests[at + slot]!;
        changed |= bit(slot);
      }
    }
    if (flags & LOADED) this.#write(index, changed);
  }

  // writes the fields `changed` of the pose of a loaded layer into its sprite, and what follows from
  // them: its visibility, its place in the stack, the changed flag
  #write(index: number, changed: number): void {
    if (changed === 0) return;
    const sprite = this.#sprites[index]!;
    const pool = this.mesh.spritePool!;
    const poses = this.#poses;
    const at = index * POSE_SIZE;

    if (changed & LAYOUT) {
      // the depth compensation of a parallax camera scales a layer at a depth by k about the focus;
      // without a camera distance in force the layers are drawn as they are, k = 1
      layoutLayerInto(this.#frame!, poses, index, this.#boxes[index]!, 1, layoutOut);
      if (changed & MOVE) {
        positionTuple[0] = layoutOut[0]!;
        positionTuple[1] = layoutOut[1]!;
        positionTuple[2] = layoutOut[2]!;
        sprite.setInstancePosition(positionTuple);
      }
      if (changed & SCALE) {
        const scale = this.#sizeScales[index]!;
        sizeTuple[0] = layoutOut[3]! * scale;
        sizeTuple[1] = layoutOut[4]! * scale;
        sprite.setQuadSize(sizeTuple);
        pool.touchVO(sprite, 'quadSize');
      }
      if (changed & bit(POSE_DEG)) {
        const rotation = this.#rotation!;
        rotation.record.typedArray![VOUtils.getIndex(sprite) * rotation.stride + rotation.offset] = layoutOut[5]!;
      }
    }
    if (changed & bit(POSE_OPACITY)) {
      const fade = this.#fade!;
      fade.record.typedArray![VOUtils.getIndex(sprite) * fade.stride + fade.offset] = poses[at + POSE_OPACITY]!;
    }
    if (changed & bit(POSE_FRAME)) {
      const prepared = this.#prepared[index]![poses[at + POSE_FRAME]!];
      if (prepared !== undefined) {
        sprite.setPreparedFrame(prepared);
        pool.touchVO(sprite, 'texCoords', 'texFlipDiagonal', 'texTrim');
      }
    }
    if (changed & bit(POSE_ORDER)) sprite.artOrder = (poses[at + POSE_ORDER]! - ORDER_MIN) * MAX_LAYERS + index;
    if (changed & STACK) this.#stackDirty = true;

    const flags = this.#flags[index]!;
    const wasShown = (flags & SHOWN) !== 0;
    const shown =
      (flags & BEHIND) === 0 &&
      poses[at + POSE_VISIBLE] !== 0 &&
      poses[at + POSE_OPACITY]! > 0 &&
      this.#prepared[index]![poses[at + POSE_FRAME]!] !== undefined;
    if (shown !== wasShown) {
      this.#flags[index] = shown ? flags | SHOWN : flags & ~SHOWN;
      sprite.visible = shown ? 1 : 0;
      pool.touchVO(sprite, 'visible');
      this.#changed = true;
    } else if (shown) {
      this.#changed = true;
    }
  }

  // --- the stack ------------------------------------------------------------------------------

  // a layer painted above another but lying behind it is drawn under it, and the picture at rest is
  // no longer the painting: said once per layer, naming the nearest layer below it
  #warnPaintedBelow(): void {
    const poses = this.#poses;
    const flags = this.#flags;
    let nearest = -1;
    for (let i = 0; i < this.#layers.length; i++) {
      if (!(flags[i]! & LOADED)) continue;
      const depth = poses[i * POSE_SIZE + POSE_DEPTH]!;
      if (nearest >= 0 && !(flags[i]! & WARNED_ORDER)) {
        const below = poses[nearest * POSE_SIZE + POSE_DEPTH]!;
        if (below < depth) {
          flags[i]! |= WARNED_ORDER;
          // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
          console.warn(
            `${this.#subject}: the layer ${describeValue(this.#names[i]!)}, painted above ${describeValue(this.#names[nearest]!)}, lies behind it — at a depth of ${depth} against ${below} — and is drawn under it: the picture at rest differs from the painting. This warning is shown once per layer.`,
          );
        }
      }
      if (nearest < 0 || depth < poses[nearest * POSE_SIZE + POSE_DEPTH]!) nearest = i;
    }
  }

  #refuseName(name: string): never {
    const names = this.#names;
    let known: string;
    if (names.length > 0) known = `its layers are ${names.map((layer) => describeValue(layer)).join(', ')}`;
    else if (!this.#settled)
      known = 'the art knows no layer yet: its source is still loading; await art.loaded, or name the layers in only';
    else known = 'the art has no layers — art.problems says why';
    throw new Error(`${this.#subject}: no layer ${describeValue(name)} — ${known}`);
  }
}
