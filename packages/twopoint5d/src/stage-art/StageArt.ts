import {Group, type Texture} from 'three/webgpu';

import {FeatureSprites} from '../sprites/FeatureSprites/FeatureSprites.js';
import {FeatureSpritesGeometry} from '../sprites/FeatureSprites/FeatureSpritesGeometry.js';
import type {PreparedSpriteFrame} from '../sprites/features/AtlasFrame.js';
import type {SpriteFeature} from '../sprites/SpriteFeature.js';
import type {IProjection} from '../stage/IProjection.js';
import {ParallaxProjection} from '../stage/ParallaxProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from '../stage/ProjectionPlane.js';
import type {DynamicAtlas} from '../texture/DynamicAtlas.js';
import type {TextureAtlas} from '../texture/TextureAtlas.js';
import type {TextureStore, TextureStoreLease} from '../texture/TextureStore.js';
import {describeValue} from '../utils/describeValue.js';
import type {VO} from '../vertex-objects/types.js';
import type {AttributeBuffer} from '../vertex-objects/VertexObjectBuffer.js';
import type {VertexObjectPool} from '../vertex-objects/VertexObjectPool.js';
import {VOUtils} from '../vertex-objects/VOUtils.js';
import {type ArtLayerInfo, type ArtLayer, ArtLayerInternals} from './ArtLayer.js';
import {type ArtFrame, anchorOf, artFrameOf, depthScaleInto, type LayerBox, layoutLayerInto, turnToPlane} from './artLayout.js';
import {
  checkPlane,
  checkProjection,
  checkStageArt,
  MAX_LAYERS,
  SHAPES,
  type StageArtOptions,
  type StageArtSource,
  shapeOf,
} from './artOptions.js';
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
  type ArtLayerSpec,
  prepareLayerFrame,
  readAtlasSource,
  readLayerFiles,
  readLooseLayers,
  type StageArtProblem,
} from './artSources.js';
import {type ArtTrack, fieldsOfTrack} from './artTrack.js';
import {LayerFilesLoad} from './loadLayerFiles.js';
import {type StageArtExtraApi, type StageArtSpriteApi, stageArtKind} from './stageArtKind.js';

// --- flags of a layer --------------------------------------------------------------------------

// a picture of the layer is there
const LOADED = 1;
// the load settled without a picture of the layer: a failed source, a layer the source lacks
const FAILED = 2;
// a depth at or behind the camera leaves the layer undrawable
const BEHIND = 4;
// the art said that the layer lies at or behind the camera; cleared once it lies in front of it again
const WARNED_BEHIND = 8;
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
// what a new camera distance writes anew of a layer at a depth: its place and its size — x stands for
// the whole position, which #write() writes as one; the depth itself, and so the stack, stay
const RELAYOUT = bit(POSE_X) | SCALE;
// no field of a pose: the distance of the camera changed, and with it whether a layer lies behind it
const CAMERA = 1 << POSE_SIZE;

// the scratch of a layout: what layoutLayerInto() writes, and the tuples the sprite setters copy from —
// a fraction in a typed array or a tuple stays unboxed, one handed to a call V8 leaves un-inlined is boxed
const layoutOut = new Float64Array(6);
const depthScaleOut = new Float64Array(1);
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

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : describeValue(error));

const problemLine = ({layer, reason}: StageArtProblem): string =>
  `${layer === undefined ? 'the source' : `the layer ${describeValue(layer)}`}: ${reason}`;

/**
 * Art layers on a stage: the layers of a painted scene — read out of an Aseprite sheet, a trimmed
 * atlas, the full-canvas layer files of a paint tool or a list of loose props — drawn as one
 * `FeatureSprites` in the plane of the stage, each at the place it was painted at, posed in the
 * units of the paint tool: artwork pixels and degrees clockwise. Add it to the scene, set poses, and
 * call {@link update} once per frame before the render; {@link takeChanged} answers a frame step of
 * a `FramePacer`.
 *
 * An art of a store item follows it: a sheet exported anew and parsed again replaces the frames,
 * boxes, pivots, tags and rests of the layers while the page runs. Each layer keeps its handle, its
 * sprite and the fields of its pose set off its rest; the layers stay those of the first load — a
 * layer the new sheet lacks stays posed and hidden, one new in it stays out —, and {@link problems}
 * says what the reload could not give.
 *
 * The art owns its mesh — the geometry and material it builds — and the `DynamicAtlas` it packs
 * layer files into, with its texture; it holds a store item while it follows it and lets go of it in
 * {@link dispose}. A store, an atlas, a texture, a renderer, a projection and a plane handed in stay
 * the caller's.
 */
export class StageArt<Features extends SpriteFeature = never> extends Group {
  /** The mesh the layers are drawn with; the art owns and disposes it. Hand it to a `SpritePicker`. */
  readonly mesh: FeatureSprites<StageArtSpriteApi & StageArtExtraApi<Features>>;
  /**
   * Resolves once every picture loaded or failed — at once for an atlas handed in —, and when the
   * art is disposed before. It never rejects: {@link problems} says what failed. A reload of a store
   * item comes after it and leaves it as it is.
   */
  readonly loaded: Promise<void>;

  readonly #subject: string;
  readonly #options: StageArtOptions;
  // the mesh as the art itself uses it, without the features of its caller; `mesh` is the same object
  readonly #core: FeatureSprites<StageArtSpriteApi>;
  readonly #pxPerUnit: number;
  #projection: IProjection | undefined;
  // the projection that places its camera at a distance from the plane: a ParallaxProjection
  #parallax: ParallaxProjection | undefined;
  // whether that distance compensates the layers at a depth: compensateDepth, true by default
  readonly #compensate: boolean;
  // the plane handed in — through the options or the setter — or the default, and whether one was handed in
  #planeOption: ProjectionPlane;
  #planeGiven: boolean;
  #warnedBoth = false;
  // a copy of the plane the mesh is turned to, compared with the plane in force in update(): a plane
  // changed in place — its normal, its up — is a plane changed as well
  #turnedTo: ProjectionPlane;
  // D, the distance of the camera of a parallax projection to the plane in units, as the last update()
  // read it: what a depth must stay in front of. NaN without a parallax camera, or before its first view
  #cameraDistance = Number.NaN;
  // the D the layers at a depth are laid out with: #cameraDistance under compensateDepth, else NaN,
  // which draws them uncompensated
  #distance = Number.NaN;
  #frame: ArtFrame | undefined;
  #canvas: {readonly width: number; readonly height: number} | undefined;
  #names: readonly string[] = Object.freeze([]);
  // a reload of a store item puts a list of its own in its place
  #problems: StageArtProblem[] = [];
  #resolveLoaded!: () => void;
  #settled = false;
  #disposed = false;
  // the lease of a store item from its first value until the following of the item holds it
  #lease: TextureStoreLease<unknown> | undefined;
  // the end of the following of a store item, and the atlas, loose layers and texture it delivered last
  #unfollow: (() => void) | undefined;
  #followedAtlas: TextureAtlas<unknown> | undefined;
  #followedLoose: readonly ArtLayerDef[] | undefined;
  #followedTexture: Texture | undefined;
  // the load of the files of a files source while it is on its way, and the atlas it packed them into
  #filesLoad: LayerFilesLoad | undefined;
  #filesAtlas: DynamicAtlas | undefined;
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
   *   loose layers, a list of full-canvas layer files, or a promise of one
   * @throws a `TypeError` or a `RangeError` — under `new StageArt()`, or `StageArt "<name>"` once the
   *   options name the art — for a source of none of the shapes, options that are no object or have
   *   a key no option has, a `name` that is no string, a `pxPerUnit` that is no finite number above
   *   0, an `origin` or `focus` that is no pair of finite numbers, a `compensateDepth` that is no
   *   boolean, a `projection` that is no `IProjection`, a `plane` that is neither a
   *   `ProjectionPlane` nor one of its four descriptions, `only` that names a layer twice, `layers`
   *   that is no object or holds options a layer cannot take, `only` or `layers` beside loose
   *   layers, loose layers that cannot be read, `features` that is no list or holds a feature
   *   `defineSprite()` refuses — in its words —, a `material` that is no object or sets what is
   *   the art's own, and a `renderer` that is no renderer. What the art cannot load or read out of
   *   its source is no refusal but a problem.
   */
  constructor(source: StageArtSource | Promise<StageArtSource>, options?: StageArtOptions<Features>) {
    super();
    this.name = 'twopoint5d.StageArt';
    const {options: opts, shape, subject} = checkStageArt(source, options);
    this.#subject = subject;
    const {plane, material} = opts;

    this.#options = opts as StageArtOptions;
    this.#pxPerUnit = opts.pxPerUnit ?? 1;
    this.#planeOption = ProjectionPlane.get(plane ?? 'xy|bottom-left');
    this.#planeGiven = plane !== undefined;
    this.#compensate = opts.compensateDepth !== false;
    this.#takeProjection(opts.projection);
    // the distance of a view the projection has given already; before its first view the layers are
    // drawn uncompensated, and no depth is refused, until an update() reads one
    this.#cameraDistance = this.#parallax?.distanceToProjectionPlane ?? Number.NaN;
    this.#distance = this.#compensate ? this.#cameraDistance : Number.NaN;
    const turnedTo = this.plane;
    this.#turnedTo = turnedTo.clone();

    // the layers known now: those of a source handed in — of a list of files the list names them —,
    // else those only names. A source loaded later without only builds the geometry of its layers once
    // they are known
    let read: {canvas: StageArt['canvas']; layers: ArtLayerSpec[]; problems: StageArtProblem[]} | undefined;
    if (shape === 'atlas') read = this.#read(source as Extract<StageArtSource, {atlas: unknown}>);
    const listed =
      shape === 'files'
        ? readLayerFiles(subject, (source as {files: readonly string[]}).files, undefined, undefined, {
            only: opts.only,
            layers: opts.layers,
          })
        : undefined;
    const names = (read ?? listed)?.layers.map((layer) => layer.name) ?? opts.only ?? [];

    this.#core = new FeatureSprites(stageArtKind(opts.features ?? []), {
      capacity: Math.min(names.length, MAX_LAYERS),
      ...material,
      transparent: material?.transparent ?? true,
      depthWrite: material?.depthWrite ?? false,
    });
    this.#core.name = 'twopoint5d.StageArt.mesh';
    this.mesh = this.#core as unknown as typeof this.mesh;
    this.#bindScalars();
    turnToPlane(this.#core, turnedTo);
    this.add(this.#core);

    this.loaded = new Promise<void>((resolve) => {
      this.#resolveLoaded = resolve;
    });

    if (read !== undefined) {
      this.#adopt(read, (source as {texture: Texture}).texture);
    } else {
      this.#createLayers(names);
      // loaded never rejects: what goes wrong past the checks of #load() is a problem of the source as well
      void this.#load(source as Promise<StageArtSource> | Exclude<StageArtSource, {atlas: unknown}>).catch((error: unknown) =>
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

  /**
   * What the art could not load or read out of its source; it says so on the console once, after the
   * load. A store item that brings a new atlas puts the list of that reload in its place — a list
   * read before stays as it was — and says it on the console once per reload.
   */
  get problems(): readonly StageArtProblem[] {
    return this.#problems;
  }

  /**
   * The projection of the stage — `stage.projection` —, handed in through the options or here: the
   * art lies in its plane, and under a `ParallaxProjection` it draws a layer at a depth as painted
   * at the rest of the camera (`compensateDepth`). A projection without a plane — a
   * `CameraProjection` — leaves the art in {@link plane}, and a projection that places no camera at
   * a distance draws depth uncompensated. A new one takes effect in the next {@link update}: the
   * art does not follow a stage whose projection is swapped; hand it the new one. An art handed a
   * projection with a plane and a plane says so once on the console. It stays the caller's.
   *
   * @throws a `TypeError` for a value that is no `IProjection`, and keeps the projection it holds
   */
  get projection(): IProjection | undefined {
    return this.#projection;
  }

  set projection(projection: IProjection | undefined) {
    if (projection !== undefined) checkProjection(this.#subject, projection);
    this.#takeProjection(projection);
  }

  /**
   * The plane the art lies in: that of the {@link projection}, else the one handed in, else
   * `'xy|bottom-left'`. A plane handed in here is a `ProjectionPlane` — it stays the caller's — or
   * one of the four descriptions; it counts where the projection has no plane, and the mesh turns
   * to a plane other than the one it faces (`ProjectionPlane#equals()`) in the next
   * {@link update}. A turn writes no sprite: the layers keep their places in the art frame.
   *
   * @throws a `TypeError` for a value that is neither a `ProjectionPlane` nor one of its four
   *   descriptions, and keeps the plane it holds
   */
  get plane(): ProjectionPlane {
    return this.#projection?.projectionPlane ?? this.#planeOption;
  }

  set plane(plane: ProjectionPlane | ProjectionPlaneDescription) {
    checkPlane(this.#subject, plane);
    this.#planeOption = ProjectionPlane.get(plane);
    this.#planeGiven = true;
    this.#warnBoth();
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
  layer(name: string): ArtLayer<StageArtExtraApi<Features>> {
    if (this.#disposed) throw new Error(`${this.#subject}: layer() is not available: this art has been disposed`);
    const index = this.#byName.get(name);
    if (index === undefined) this.#refuseName(name);
    return this.#layers[index]! as ArtLayer<StageArtExtraApi<Features>>;
  }

  /** The layer of a sprite of the mesh — the `sprite` a `SpritePicker` answers —; `undefined` for another, and once disposed. */
  layerOf(sprite: object): ArtLayer<StageArtExtraApi<Features>> | undefined {
    if (this.#disposed) return undefined;
    return this.#bySprite.get(sprite) as ArtLayer<StageArtExtraApi<Features>> | undefined;
  }

  /**
   * Writes the fields of `pose` into the layer `name` and keeps the rest; a pose set before the
   * picture of the layer has arrived is kept and shown once it is there. Each field is checked
   * before any is written: a field that is no finite number, an `opacity` outside 0 … 1, a `frame`
   * that is no whole number of 0 or more — or, once the frames are known, no index into them —, an
   * `order` that is no whole number from -1024 to 1023, a `depth` at or behind the camera of a
   * `ParallaxProjection` whose distance is known — compensated or not, since the camera stands
   * there either way —, a `visible` that is no boolean and a key that is no field of a pose throw,
   * naming the layer and the field, and the layer keeps what it held. The distance is that of the
   * last {@link update}, and a layer at a depth is written with its depth compensation. Allocates nothing. Once disposed it writes nothing, and still turns away
   * what it cannot use.
   *
   * @throws an `Error` for a name the art does not know, listing the names
   */
  set(name: string, pose: ArtPose): void {
    const index = this.#byName.get(name);
    if (index === undefined) this.#refuseName(name);
    this.#set(index, pose);
  }

  /**
   * Samples `track` at `seconds` into the layer `name`: `set()` with the pose the track shows then,
   * through a pose of the art's own, so a caller needs none. The fields the track does not have stay
   * as they are. Allocates nothing. Once disposed it writes nothing, and still turns away what it
   * cannot use.
   *
   * @throws an `Error` for a name the art does not know, a `TypeError` for a track that is no
   *   `ArtTrack`, what `ArtTrack#sample()` refuses of `seconds` and what `set()` refuses of the pose
   */
  apply(name: string, track: ArtTrack, seconds: number): void {
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
   * `visible`, an `opacity` from or to 0, its picture arriving or going with a reload, or a camera
   * distance that leaves it behind the camera or brings it back — or changed its place in the
   * stack, when an {@link update} turned the mesh to another plane or laid the layers at a depth out
   * for a new distance, and when a store item it follows brought a new atlas or texture while a
   * layer is shown. A hidden layer that moves, and a value set again, answer `false`. A write through
   * `layer.sprite` is the caller's to report. `false` once disposed. Allocates nothing.
   */
  takeChanged(): boolean {
    const changed = this.#changed;
    this.#changed = false;
    return changed && !this.#disposed;
  }

  /**
   * Once per frame, before the render: turns the mesh to the {@link plane} where it changed; under
   * a `ParallaxProjection` reads the distance of its camera to the plane, and where it differs from
   * the one of the last update lays the layers at a depth out anew under `compensateDepth` — a layer
   * it leaves at or behind the camera, compensated or not, is hidden and, where it would be shown,
   * said once on the console, until a depth or a distance brings it in front of the camera again —; sorts the layers back to front where a depth or an order changed
   * — by depth, the farthest first, then by order, then as painted —; and updates the mesh. The
   * first update that finds a layer painted above another lying behind it says so on the console,
   * once per layer. Allocates nothing without a sort, a turn or a new distance. Does nothing once
   * disposed.
   */
  update(): void {
    if (this.#disposed) return;
    const plane = this.plane;
    if (!plane.equals(this.#turnedTo)) this.#turnTo(plane);
    const distance = this.#parallax === undefined ? Number.NaN : this.#parallax.distanceToProjectionPlane;
    // NaN against NaN is no new distance: there is no camera to stand behind, and nothing to compensate
    if (distance !== this.#cameraDistance && !(Number.isNaN(distance) && Number.isNaN(this.#cameraDistance))) {
      this.#takeCameraDistance(distance);
    }
    if (this.#stackDirty) {
      this.#stackDirty = false;
      // two stable passes: the second keeps the order of the first among layers of one depth, so the
      // stack is the same whatever the history of the sort
      this.#core.sortBy('artOrder');
      this.#core.sortBy('z');
      this.#warnPaintedBelow();
    }
    this.#core.update();
  }

  /**
   * Leaves the parent, disposes the mesh — its geometry and material — and the atlas it packed
   * layer files into, with its texture, and ends the following of a store item, which lets go of it;
   * a texture, an atlas, a store, a renderer and a projection handed in stay the caller's. A load
   * still on its way is dropped when it lands — the requests of layer files are aborted, and each
   * decoded picture is closed, at once or the moment it lands —, and {@link loaded} resolves; so is
   * a value of a followed store item that still comes. Afterwards `set()`,
   * `apply()`, `reset()` and `update()` write nothing — `set()` and `apply()` still refuse what they
   * cannot use —, `takeChanged()` answers `false`, `layer()`
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
    this.#core.dispose();
    this.#geometry?.dispose();
    this.#geometry = undefined;
    this.#unfollow?.();
    this.#unfollow = undefined;
    this.#lease?.release();
    this.#lease = undefined;
    this.#filesLoad?.drop();
    this.#filesLoad = undefined;
    this.#filesAtlas?.dispose();
    this.#filesAtlas = undefined;
    this.#bySprite.clear();
    this.#settled = true;
    this.#resolveLoaded();
  }

  // --- the plane and the camera ---------------------------------------------------------------

  #takeProjection(projection: IProjection | undefined): void {
    this.#projection = projection;
    this.#parallax = projection instanceof ParallaxProjection ? projection : undefined;
    this.#warnBoth();
  }

  #warnBoth(): void {
    if (this.#warnedBoth || !this.#planeGiven || this.#projection?.projectionPlane === undefined) return;
    this.#warnedBoth = true;
    // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
    console.warn(
      `${this.#subject}: it was handed both a projection with a plane and a plane — it lies in the plane of the projection; leave out plane, or the projection. This warning is shown once per art.`,
    );
  }

  // turns the mesh to `plane`; the layers keep their places in the art frame, so no sprite is written
  #turnTo(plane: ProjectionPlane): void {
    this.#turnedTo = plane.clone();
    turnToPlane(this.#core, plane);
    if (this.#anyShown()) this.#changed = true;
  }

  // takes the camera distance `distance` — NaN for none —: under compensateDepth it lays the layers at a
  // depth out anew for it, whose place and size follow k; without, a depth is drawn as it is and only a
  // layer in front of the plane can come to lie behind the camera, or come back. The layers on the plane
  // have k = 1 under every distance, and set() writes them alone
  #takeCameraDistance(distance: number): void {
    this.#cameraDistance = distance;
    const compensate = this.#compensate;
    if (compensate) this.#distance = distance;
    const mask = compensate ? RELAYOUT | CAMERA : CAMERA;
    const poses = this.#poses;
    const flags = this.#flags;
    for (let i = 0; i < this.#layers.length; i++) {
      if (!(flags[i]! & LOADED)) continue;
      const depth = poses[i * POSE_SIZE + POSE_DEPTH]!;
      if (compensate ? depth !== 0 : depth < 0) this.#write(i, mask);
    }
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

  async #load(source: Promise<StageArtSource> | Exclude<StageArtSource, {atlas: unknown}>): Promise<void> {
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

    if (shapeOf(resolved) === 'files') {
      await this.#loadFiles(resolved as Extract<StageArtSource, {files: unknown}>);
      return;
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
      const layers = (resolved as {layers?: readonly ArtLayerDef[]}).layers;
      this.#adopt(this.#read({atlas, layers}), texture);
      this.#follow(store, id, atlas, layers, texture);
      return;
    }
    ({atlas, texture} = resolved as {atlas: TextureAtlas<unknown>; texture: Texture});
    const layers = (resolved as {layers?: readonly ArtLayerDef[]}).layers;
    this.#adopt(this.#read({atlas, layers}), texture);
  }

  // follows the store item the art loaded from (§5.5): a new atlas — a sheet exported anew and parsed
  // again — or a new texture reaches the running art. The subscription holds the item as the lease
  // did, which goes once it is in place; on() hands over the values it has at once, which the art
  // has already
  #follow(
    store: TextureStore,
    id: string,
    atlas: TextureAtlas<unknown>,
    loose: readonly ArtLayerDef[] | undefined,
    texture: Texture,
  ): void {
    this.#followedAtlas = atlas;
    this.#followedLoose = loose;
    this.#followedTexture = texture;
    this.#unfollow = store.on(id, ['atlas', 'texture'], ([nextAtlas, nextTexture]) => this.#reload(nextAtlas, nextTexture));
    this.#lease?.release();
    this.#lease = undefined;
  }

  // a value of the store item the art follows: a new atlas is read again with the options of the art,
  // and the layers of the first load take what it says of them; a new texture alone is swapped in
  #reload(atlas: TextureAtlas<unknown>, texture: Texture): void {
    // dispose() ended the following; a value that still comes is dropped
    if (this.#disposed) return;
    if (atlas !== this.#followedAtlas) {
      this.#followedAtlas = atlas;
      this.#reread(this.#read({atlas, layers: this.#followedLoose}));
    }
    if (texture !== this.#followedTexture) {
      this.#followedTexture = texture;
      this.#core.setTexture('colorMap', texture);
      if (this.#anyShown()) this.#changed = true;
    }
  }

  // the layer set stays the one of the first load: a layer the reloaded source has gets its frames,
  // box, pivot, tags and rest anew and keeps the fields of its pose set off its rest; a layer it lacks
  // stays posed and hidden; a layer new in it stays out. The problems of the reload replace the list
  #reread(read: {canvas: StageArt['canvas']; layers: ArtLayerSpec[]; problems: StageArtProblem[]}): void {
    this.#problems = read.problems;
    this.#canvas = read.canvas === undefined ? undefined : Object.freeze({width: read.canvas.width, height: read.canvas.height});
    const {pxPerUnit, origin, focus} = this.#options;
    this.#frame = artFrameOf(this.#subject, pxPerUnit, origin, focus, read.canvas);

    const specs = new Map<string, ArtLayerSpec>();
    for (const spec of read.layers) if (!specs.has(spec.name)) specs.set(spec.name, spec);
    for (let i = 0; i < this.#layers.length; i++) {
      const name = this.#names[i]!;
      let spec = specs.get(name);
      if (spec === undefined) {
        this.#problems.push({
          layer: name,
          reason: `the reloaded source has no layer ${describeValue(name)} — the layer stays hidden`,
        });
        spec = this.#lackingSpec(i);
      }
      this.#settleLayer(i, spec, true);
    }
    for (const name of specs.keys()) {
      if (!this.#byName.has(name)) {
        this.#problems.push({
          layer: name,
          reason: `the reloaded source has a layer ${describeValue(name)} the art did not load with — it stays out of this art; a new StageArt takes it`,
        });
      }
    }
    this.#stackDirty = true;
    this.#warnProblems('its source reloaded with');
  }

  // a layer the reloaded source lacks: no frames, a box of no size at its pivot, and the rest it had,
  // so that the fields of its pose stay as they are
  #lackingSpec(index: number): ArtLayerSpec {
    const layer = this.#layers[index]!;
    const at = index * POSE_SIZE;
    const pivotX = layer.pivot?.[0] ?? this.#rests[at + POSE_X]!;
    const pivotY = layer.pivot?.[1] ?? this.#rests[at + POSE_Y]!;
    return {
      name: layer.name,
      box: {x: pivotX, y: pivotY, w: 0, h: 0},
      pivotX,
      pivotY,
      depth: this.#rests[at + POSE_DEPTH]!,
      frames: [],
      tags: new Map(),
      rest: layer.rest,
      order: this.#rests[at + POSE_ORDER]!,
    };
  }

  #anyShown(): boolean {
    for (let i = 0; i < this.#layers.length; i++) if (this.#flags[i]! & SHOWN) return true;
    return false;
  }

  // the files of a files source, loaded, trimmed and packed into an atlas of the art's own (§4.2, §5.1).
  // A set of pictures too large for one atlas fails the source as a whole: the load cannot refuse it
  // to the caller, so it is the problem of the source the refusal would have been
  async #loadFiles({files, baseUrl}: Extract<StageArtSource, {files: unknown}>): Promise<void> {
    const load = new LayerFilesLoad();
    this.#filesLoad = load;
    const outcome = await load.run(files, baseUrl, this.#options.renderer);
    this.#filesLoad = undefined;
    // dropped by dispose(), which closed its bitmaps
    if (outcome === undefined) return;
    if (this.#disposed) {
      outcome.atlas?.dispose();
      return;
    }
    const {only, layers} = this.#options;
    const read = readLayerFiles(this.#subject, files, outcome.results, outcome.canvas, {only, layers});
    if (outcome.refusal !== undefined) {
      this.#problems.push(...read.problems);
      this.#fail(outcome.refusal);
      return;
    }
    this.#filesAtlas = outcome.atlas;
    this.#adopt(read, outcome.atlas?.texture);
  }

  // the source failed as a whole: every layer stays hidden, and one problem says why
  #fail(reason: string): void {
    if (this.#settled) return;
    this.#problems.push({layer: undefined, reason});
    for (let i = 0; i < this.#layers.length; i++) this.#flags[i]! |= FAILED;
    this.#finish();
  }

  // `texture` is undefined for files of which none is drawn: no layer shows a picture
  #adopt(
    read: {canvas: StageArt['canvas']; layers: ArtLayerSpec[]; problems: StageArtProblem[]},
    texture: Texture | undefined,
  ): void {
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
      if (this.#core.spritePool!.capacity < layers.length) {
        const geometry = new FeatureSpritesGeometry(this.#core.kind, {capacity: layers.length});
        this.#core.geometry = geometry;
        this.#geometry = geometry;
        this.#bindScalars();
      }
      this.#createLayers(layers.map((layer) => layer.name));
    }
    for (let i = 0; i < layers.length; i++) this.#settleLayer(i, layers[i]!, false);

    if (texture !== undefined) this.#core.setTexture('colorMap', texture);
    this.#stackDirty = true;
    this.#finish();
  }

  #finish(): void {
    if (this.#settled) return;
    this.#settled = true;
    this.#warnProblems(undefined);
    this.#resolveLoaded();
  }

  // the problems on the console, once per load and once per reload; `lead` goes before the count
  #warnProblems(lead: string | undefined): void {
    const problems = this.#problems;
    if (problems.length === 0) return;
    const one = problems.length === 1;
    // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
    console.warn(
      `${this.#subject}: ${lead === undefined ? '' : `${lead} `}${problems.length} problem${one ? '' : 's'} — art.problems lists ${one ? 'it' : 'them'}: ${problems.map(problemLine).join('; ')}`,
    );
  }

  #bindScalars(): void {
    const pool = this.#core.spritePool!;
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
      const sprite = this.#core.createSprite()!;
      sprite.visible = 0;
      sprite.artOrder = -ORDER_MIN * MAX_LAYERS + i;
      // a new sprite stands at the rest of a pose: scale 1, opacity 1, shown
      this.#poses[i * POSE_SIZE + POSE_SCALE_X] = 1;
      this.#poses[i * POSE_SIZE + POSE_SCALE_Y] = 1;
      this.#poses[i * POSE_SIZE + POSE_OPACITY] = 1;
      this.#poses[i * POSE_SIZE + POSE_VISIBLE] = 1;
      const layer = ArtLayerInternals.create(this as StageArt<never>, i, names[i]!, sprite);
      this.#sprites.push(sprite);
      this.#layers.push(layer);
      this.#byName.set(names[i]!, i);
      this.#bySprite.set(sprite, layer);
    }
  }

  // what the source says about the layer `index`: its frames, its box and its rest, under the fields
  // set before the load — or, on a `reload`, the fields of its pose set off its rest —; then the
  // whole sprite is written, or hidden where the layer has no picture
  #settleLayer(index: number, spec: ArtLayerSpec, reload: boolean): void {
    const frame = this.#frame!;
    const at = index * POSE_SIZE;
    const rests = this.#rests;
    const poses = this.#poses;
    if (reload) {
      // a field at its rest follows the rest the reloaded source gives; one set off it stays
      let kept = 0;
      for (let slot = 0; slot < POSE_SIZE; slot++) if (poses[at + slot] !== rests[at + slot]) kept |= bit(slot);
      this.#preset[index] = kept;
    }
    const {box} = spec;
    const prepared = spec.frames.map((frameSpec) => (frameSpec === undefined ? undefined : prepareLayerFrame(frameSpec, box)));
    const frameCount = spec.frames.length;
    const loaded = prepared.some((entry) => entry !== undefined);
    this.#prepared[index] = prepared;
    this.#frameCounts[index] = frameCount;
    this.#boxes[index] = box;
    this.#sizeScales[index] = spec.pxPerUnit === undefined ? 1 : frame.pxPerUnit / spec.pxPerUnit;

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

    const preset = this.#preset[index]!;
    for (let slot = 0; slot < POSE_SIZE; slot++) {
      if (!(preset & bit(slot))) poses[at + slot] = rests[at + slot]!;
    }
    this.#preset[index] = 0;
    if (frameCount > 0 && poses[at + POSE_FRAME]! >= frameCount) {
      const frames = `its ${frameCount} frame${frameCount === 1 ? '' : 's'}`;
      this.#problems.push({
        layer: name,
        reason: reload
          ? `the frame ${poses[at + POSE_FRAME]} it showed lies beyond ${frames} in the reloaded source — the layer shows frame 0`
          : `the frame ${poses[at + POSE_FRAME]} set before the layer loaded lies beyond ${frames} — the layer shows frame 0`,
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

    this.#flags[index] = (this.#flags[index]! & ~(LOADED | FAILED)) | (loaded ? LOADED : FAILED);
    const sprite = this.#sprites[index]!;
    // a box of no size — a layer without a picture — has no anchor in it
    if (box.w > 0 && box.h > 0) {
      anchorOf(box, spec.pivotX, spec.pivotY, anchorOut);
      anchorTuple[0] = anchorOut[0]!;
      anchorTuple[1] = anchorOut[1]!;
      sprite.setAnchor(anchorTuple);
    }
    if (loaded) this.#write(index, ALL_FIELDS);
    else this.#hide(index);
    // every attribute of the sprite, the static ones too: the mesh may have been updated before
    this.#core.spritePool?.touchVO(sprite);
  }

  // a layer whose picture a reload took away: its sprite hidden, a change where it was shown
  #hide(index: number): void {
    const flags = this.#flags[index]!;
    if (!(flags & SHOWN)) return;
    this.#flags[index] = flags & ~SHOWN;
    this.#sprites[index]!.visible = 0;
    this.#changed = true;
  }

  // --- poses ----------------------------------------------------------------------------------

  // the checks stay inline — a value handed to a call V8 leaves un-inlined is boxed —, and a refusal
  // builds its message in checkPoseField() and refusePoseField(), which only a refusal calls
  #set(index: number, pose: ArtPose): void {
    const subject = this.#subjects[index]!;
    if (typeof pose !== 'object' || pose === null) {
      throw new TypeError(`${subject}: the pose must be an object of the fields of an ArtPose, got ${describeValue(pose)}`);
    }
    for (const key in pose) if (!isPoseKey(key)) refuseUnknownPoseField(subject, 'the pose', key);
    const {x, y, depth, deg, scaleX, scaleY, opacity, frame, visible, order} = pose;
    if (x !== undefined && !(typeof x === 'number' && Number.isFinite(x))) checkPoseField(subject, 'x', x);
    if (y !== undefined && !(typeof y === 'number' && Number.isFinite(y))) checkPoseField(subject, 'y', y);
    if (depth !== undefined) {
      if (!(typeof depth === 'number' && Number.isFinite(depth))) checkPoseField(subject, 'depth', depth);
      // at or behind the camera, where its distance is known: D + δ ≤ 0. NaN, no distance, compares false
      if (this.#cameraDistance + depth / this.#pxPerUnit <= 0) this.#refuseDepth(index, depth);
    }
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
    // a disposed art still turns away what it cannot use, and writes nothing
    if (this.#disposed) return;
    this.#commit(index, given);
  }

  #apply(index: number, track: ArtTrack, seconds: number): void {
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
    if (fields & bit(POSE_DEPTH)) {
      // a key of a dolly that a camera come closer leaves at or behind it, before any field is written
      if (this.#cameraDistance + pose.depth! / this.#pxPerUnit <= 0) this.#refuseDepth(index, pose.depth!);
      row[POSE_DEPTH] = pose.depth!;
    }
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
    if (this.#disposed) return;
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
    // under a camera distance a depth is a k, which scales the size as well as the place
    if (changed & bit(POSE_DEPTH) && !Number.isNaN(this.#distance)) changed |= SCALE;
    const sprite = this.#sprites[index]!;
    const pool = this.#core.spritePool!;
    const poses = this.#poses;
    const at = index * POSE_SIZE;

    if (changed & (bit(POSE_DEPTH) | CAMERA)) {
      // at or behind the camera of a parallax projection — D + δ ≤ 0, compensated or not — the layer
      // cannot be drawn. set() turns such a depth away; a new distance, a rest or a pose set before the
      // load leave a layer there. NaN, no camera distance, compares false
      if (this.#cameraDistance + poses[at + POSE_DEPTH]! / this.#pxPerUnit <= 0) this.#flags[index]! |= BEHIND;
      else this.#flags[index]! &= ~(BEHIND | WARNED_BEHIND);
    }

    if (changed & LAYOUT) {
      // the depth compensation of a parallax camera scales a layer at a depth by k = (D + δ) / D about
      // the focus; without a camera distance in force the layers are drawn as they are, k = 1 — and so
      // is a layer behind the camera, hidden until it comes back
      const frame = this.#frame!;
      if (this.#flags[index]! & BEHIND) depthScaleOut[0] = 1;
      else depthScaleInto(this.#distance, poses[at + POSE_DEPTH]!, frame, depthScaleOut);
      layoutLayerInto(frame, poses, index, this.#boxes[index]!, depthScaleOut[0]!, layoutOut);
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

    let flags = this.#flags[index]!;
    const wasShown = (flags & SHOWN) !== 0;
    const showable =
      poses[at + POSE_VISIBLE] !== 0 &&
      poses[at + POSE_OPACITY]! > 0 &&
      this.#prepared[index]![poses[at + POSE_FRAME]!] !== undefined;
    // the warning is for a layer the camera holds back, not for one the caller has hidden: it comes once
    // the layer would be shown, and once until the layer lies in front of the camera again
    if (showable && (flags & (BEHIND | WARNED_BEHIND)) === BEHIND) {
      flags |= WARNED_BEHIND;
      this.#flags[index] = flags;
      this.#warnBehind(index);
    }
    const shown = showable && (flags & BEHIND) === 0;
    if (shown !== wasShown) {
      this.#flags[index] = shown ? flags | SHOWN : flags & ~SHOWN;
      sprite.visible = shown ? 1 : 0;
      pool.touchVO(sprite, 'visible');
      this.#changed = true;
    } else if (shown && changed & ~CAMERA) {
      // a new camera distance alone, without a layout, changes nothing a shown layer shows
      this.#changed = true;
    }
  }

  #warnBehind(index: number): void {
    const depth = this.#poses[index * POSE_SIZE + POSE_DEPTH]!;
    // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
    console.warn(
      `${this.#subject}: the layer ${describeValue(this.#names[index]!)}, at a depth of ${depth}, lies at or behind the camera, which stands ${this.#cameraDistance * this.#pxPerUnit} artwork pixels in front of the plane — it is hidden until its depth or the distance of the camera brings it in front of the camera again. This warning is shown once until then.`,
    );
  }

  // turns away a depth at or behind the camera in force, where its distance is known
  #refuseDepth(index: number, depth: number): never {
    const camera = this.#cameraDistance * this.#pxPerUnit;
    refusePoseField(
      this.#subjects[index]!,
      'depth',
      depth,
      `a number above ${-camera} — the camera stands ${camera} artwork pixels in front of the plane —`,
    );
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
