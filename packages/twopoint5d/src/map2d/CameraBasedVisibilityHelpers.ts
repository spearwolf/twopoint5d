import type {ColorRepresentation, LineBasicMaterial, Object3D} from 'three/webgpu';
import {Box3, Box3Helper, BoxGeometry, Color, Mesh, MeshBasicMaterial, PlaneHelper, Vector3} from 'three/webgpu';
import {Dependencies, type DependencyValues} from '../utils/Dependencies.js';
import {undefinedValueError} from '../utils/expectDefined.js';
import type {CameraBasedVisibility, TileBox} from './CameraBasedVisibility.js';
import {HelpersManager} from './HelpersManager.js';
import type {IMap2DVisibilitorHelpers} from './types.js';

const _size = new Vector3();

// where `#seenKnobs` keeps each of the number fields that shape the set
const SEEN_MAX_DEBUG_HELPERS = 0;
const SEEN_TILE_BOX_HELPER_EXPAND = 1;
const SEEN_FRUSTUM_BOX_HELPER_EXPAND = 2;

/** The color fields of {@link CameraBasedVisibilityHelpers} the dependency gate compares. */
interface HelperColors {
  frustumBoxHelperColor: Color;
  frustumBoxPrimaryHelperColor: Color;
  tileBoxHelperColor: Color;
  tileBoxPrimaryHelperColor: Color;
}

/**
 * A solid box marking a point in the scene, in the shape the three.js helpers have: it owns
 * the geometry and the material it is built from and releases both in {@link dispose}. That
 * is what {@link HelpersManager.add} asks of a node handed to it.
 *
 * It is built as a unit cube and takes its size from `scale`, so the same node can mark a
 * point of any size.
 */
class PointHelper extends Mesh<BoxGeometry, MeshBasicMaterial> {
  constructor() {
    super(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  }

  dispose(): void {
    // a mesh whose geometry slot is empty cannot be rendered, so it leaves the scene graph
    // before it gives geometry and material up, rather than asking the caller for that order
    this.removeFromParent();

    this.geometry.dispose();
    this.material.dispose();
  }
}

export class CameraBasedVisibilityHelpers implements IMap2DVisibilitorHelpers {
  #show = false;
  #disposed = false;

  /**
   * How many frustum box helpers are built for tiles no probe ray met directly. The frustum
   * boxes of the primary tiles and the tile boxes are not meant: those follow the number of
   * visible tiles.
   */
  maxDebugHelpers = 9;

  tileBoxHelperExpand = -0.01;
  frustumBoxHelperExpand = 0;

  frustumBoxHelperColor = new Color(0x777777);
  frustumBoxPrimaryHelperColor = new Color(0xffffff);

  tileBoxHelperColor = new Color(0x772222);
  tileBoxPrimaryHelperColor = new Color(0xff0066);

  readonly #helpers = new HelpersManager();

  // The helper nodes this class keeps alive across updates. A node is built once and then
  // written to; `HelpersManager` disposes it when the whole set goes down, and only then.
  #planeHelper?: PlaneHelper;
  readonly #pointHelpers: PointHelper[] = [];
  readonly #frustumBoxHelpers: Box3Helper[] = [];
  readonly #tileBoxHelpers: Box3Helper[] = [];

  // How many of each pool the current set uses. Whatever sits above that is kept, hidden.
  #pointCount = 0;
  #frustumBoxCount = 0;
  #tileBoxCount = 0;

  // The `serial` of the visibility the current set was built from. -1 means: nothing built.
  #builtSerial = -1;

  // The public fields of this class shape the set that gets built, so a set built from other
  // values is out of date just as a set built from an older visibility is. The colors go through
  // here: `cloneable` keeps a copy of each, which catches a color written in place as well as one
  // assigned.
  readonly #knobs = new Dependencies<HelperColors>([
    Dependencies.cloneable<Color>('frustumBoxHelperColor'),
    Dependencies.cloneable<Color>('frustumBoxPrimaryHelperColor'),
    Dependencies.cloneable<Color>('tileBoxHelperColor'),
    Dependencies.cloneable<Color>('tileBoxPrimaryHelperColor'),
  ]);

  // what `#knobs` is asked about, written again on every pass rather than built as a new literal
  readonly #knobValues: DependencyValues<HelperColors> = {
    frustumBoxHelperColor: null,
    frustumBoxPrimaryHelperColor: null,
    tileBoxHelperColor: null,
    tileBoxPrimaryHelperColor: null,
  };

  // The number fields the last pass saw, held against the fields instead of through `#knobs`: a
  // fractional value read through the generic lookup of `Dependencies` is boxed on every pass, and
  // a typed array holds a double as it is. `NaN` equals nothing, so the first pass counts as a
  // change.
  readonly #seenKnobs = new Float64Array([NaN, NaN, NaN]);

  // Scratch of `updatePlaneHelpers()`: the points that mark the axes of the plane, written again on
  // every build. `placePointHelper()` copies a point, so the next build may write over them.
  readonly #planeAxisOrigin = new Vector3();
  readonly #planeAxisShift = new Vector3();
  readonly #planeAxisX = new Vector3();
  readonly #planeAxisY = new Vector3();

  constructor(public readonly cameraBasedVisibility: CameraBasedVisibility) {}

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Whether the helper nodes are built at all. Switching it off takes the current set down and
   * releases every node in it. Switching it on builds the set right away when {@link add} has
   * named a scene; without one, the first {@link update} after `add()` builds it.
   *
   * On a disposed set this answers `false` and a write to it does nothing.
   */
  get show() {
    return this.#show;
  }

  set show(show: boolean) {
    if (this.#disposed) return;
    if (this.#show === show) return;
    this.#show = show;
    if (show) {
      this.update();
    } else {
      this.#helpers.remove();
      this.releasePools();
    }
  }

  private createHelpers(): void {
    this.#pointCount = 0;
    this.#frustumBoxCount = 0;
    this.#tileBoxCount = 0;

    this.updatePlaneHelpers();
    this.updateTileHelpers(this.cameraBasedVisibility.visibles);

    this.hideSurplus();
  }

  private updatePlaneHelpers(): void {
    if (this.#planeHelper === undefined) {
      // the helper holds the plane as a reference and follows it on its own
      this.#planeHelper = new PlaneHelper(this.cameraBasedVisibility.planeWorld, 100, 0x20f040);
      this.#helpers.add(this.#planeHelper, true);
    }

    if (this.cameraBasedVisibility.pointOnPlane) {
      this.placePointHelper(this.cameraBasedVisibility.pointOnPlane, 10, 0xc0c0c0);
    }

    // the further points the probe rays of the view frustum found — the first of them is the
    // one `pointOnPlane` carries, and that one is already marked
    const pointsOnPlane = this.cameraBasedVisibility.pointsOnPlane;
    for (let i = 1; i < pointsOnPlane.length; ++i) {
      // The loop bound is `pointsOnPlane.length`.
      this.placePointHelper(pointsOnPlane[i]!, 6, 0x20c0ff);
    }

    this.placePointHelper(this.cameraBasedVisibility.planeOrigin, 5, 0x406090);

    const origin = this.makePointOnPlane(0, 0, this.#planeAxisOrigin);
    const shift = this.#planeAxisShift.subVectors(this.cameraBasedVisibility.planeOrigin, origin);
    const axisX = this.makePointOnPlane(50, 0, this.#planeAxisX).add(shift);
    const axisY = this.makePointOnPlane(0, 50, this.#planeAxisY).add(shift);

    this.placePointHelper(axisX, 5, 0xff0000);
    this.placePointHelper(axisY, 5, 0x00ff00);
  }

  private updateTileHelpers(visibles: TileBox[]): void {
    // the frustum boxes of the primary tiles first, the ones of the other tiles after them
    for (let i = 0; i < visibles.length; ++i) {
      // The loop bound is `visibles.length`.
      const tile = visibles[i]!;
      if (!tile.primary) continue;

      const frustumBox = tile.frustumBox;
      if (frustumBox == null) throw undefinedValueError(`the frustum box of tile ${tile.x},${tile.y}`);
      this.placeFrustumBoxHelper(frustumBox, this.frustumBoxPrimaryHelperColor);
    }

    // counted rather than read off the loop index: `maxDebugHelpers` is a number of helpers, and
    // the index says how many tiles the walk has passed
    let debugHelpers = 0;

    for (let i = 0; i < visibles.length; ++i) {
      // The loop bound is `visibles.length`.
      const tile = visibles[i]!;

      if (!tile.primary && debugHelpers < this.maxDebugHelpers) {
        debugHelpers += 1;
        const frustumBox = tile.frustumBox;
        if (frustumBox == null) throw undefinedValueError(`the frustum box of tile ${tile.x},${tile.y}`);
        this.placeFrustumBoxHelper(frustumBox, this.frustumBoxHelperColor);
      }

      const box = tile.box;
      if (box == null) throw undefinedValueError(`the box of tile ${tile.x},${tile.y}`);
      this.placeTileBoxHelper(box, tile.primary ? this.tileBoxPrimaryHelperColor : this.tileBoxHelperColor);
    }
  }

  private placePointHelper(point: Vector3, size: number, color: ColorRepresentation): void {
    let helper = this.#pointHelpers[this.#pointCount];
    if (helper === undefined) {
      helper = new PointHelper();
      this.#pointHelpers.push(helper);
      this.#helpers.add(helper, true);
    }
    helper.visible = true;
    helper.position.copy(point);
    helper.scale.setScalar(size);
    helper.material.color.set(color);
    this.#pointCount += 1;
  }

  private placeFrustumBoxHelper(box: Box3, color: Color): void {
    this.placeBoxHelper(this.#frustumBoxHelpers, this.#frustumBoxCount, true, box, color);
    this.#frustumBoxCount += 1;
  }

  private placeTileBoxHelper(box: Box3, color: Color): void {
    this.placeBoxHelper(this.#tileBoxHelpers, this.#tileBoxCount, false, box, color);
    this.#tileBoxCount += 1;
  }

  // `frustumBox` names the pool: a frustum box is in world space and goes into the root, a tile
  // box is in the local space of the map node and goes into the scene
  private placeBoxHelper(pool: Box3Helper[], index: number, frustumBox: boolean, box: Box3, color: Color): void {
    let helper = pool[index];
    if (helper === undefined) {
      // its own Box3: the helper follows whatever sits in `box`, and the boxes of a TileBox
      // belong to the visibility and are rewritten there
      helper = new Box3Helper(new Box3(), color);
      pool.push(helper);
      this.#helpers.add(helper, frustumBox);
    }
    helper.visible = true;
    helper.box.copy(box);
    // the factor is read here and multiplied in place rather than handed on as an argument: a
    // fractional value handed to a call the compiler does not inline is boxed, once per box
    const expand = frustumBox ? this.frustumBoxHelperExpand : this.tileBoxHelperExpand;
    const size = helper.box.getSize(_size);
    size.x *= expand;
    size.y *= expand;
    size.z *= expand;
    helper.box.expandByVector(size);
    // `Box3Helper` types its material as `Material | Material[]`; three builds it with a single
    // `LineBasicMaterial`, and the color of that one is what the caller picked
    (helper.material as LineBasicMaterial).color.copy(color);
  }

  /** A node the current set does not need stays in the pool and out of sight. */
  private hideSurplus(): void {
    for (let i = this.#pointCount; i < this.#pointHelpers.length; ++i) this.#pointHelpers[i]!.visible = false;
    for (let i = this.#frustumBoxCount; i < this.#frustumBoxHelpers.length; ++i) this.#frustumBoxHelpers[i]!.visible = false;
    for (let i = this.#tileBoxCount; i < this.#tileBoxHelpers.length; ++i) this.#tileBoxHelpers[i]!.visible = false;
  }

  /**
   * Forgets the pooled nodes. Whoever calls this has just handed the whole set to the manager
   * to take down, and the manager disposes what it takes down — a pool that kept its entries
   * would hand out released geometry on the next update.
   */
  private releasePools(): void {
    this.#planeHelper = undefined;
    this.#pointHelpers.length = 0;
    this.#frustumBoxHelpers.length = 0;
    this.#tileBoxHelpers.length = 0;
    this.#pointCount = 0;
    this.#frustumBoxCount = 0;
    this.#tileBoxCount = 0;
    this.#builtSerial = -1;
  }

  private makePointOnPlane(x: number, y: number, target: Vector3): Vector3 {
    return target
      .set(this.cameraBasedVisibility.map2dTileCoords.xOffset + x, 0, this.cameraBasedVisibility.map2dTileCoords.yOffset + y)
      .applyMatrix4(this.cameraBasedVisibility.matrixWorld);
  }

  /**
   * Names the scene the helper nodes go into. The scene named here is the map node: the tile
   * boxes are in its local space and go into it, while the plane, the points and the frustum
   * boxes are in world space and go into the root above it.
   *
   * On a disposed set this does nothing: no scene is taken, and none is built for.
   */
  add(scene: Object3D): void {
    if (this.#disposed) return;
    if (this.#helpers.scene === scene) return;
    this.#helpers.scene = scene;
    this.releasePools();
  }

  /**
   * Takes the whole set down and gives the nodes it holds up. Its nodes sit in the scene
   * {@link add} was given and in the root above it, and they only ever come down together —
   * so that scene is the one to hand over here, and a call naming another is turned away:
   * taking the set down by halves would leave the pools pointing at released nodes.
   *
   * The scene stays named and {@link show} stays on, so this takes the current nodes down and
   * not the set as such: the next {@link update} builds the same set again, out of fresh nodes.
   * Whoever wants it to stay down turns {@link show} off.
   *
   * On a disposed set this does nothing — its nodes are already down and released.
   */
  remove(scene: Object3D): void {
    if (this.#disposed) return;
    if (this.#helpers.scene !== scene) return;
    this.#helpers.remove();
    this.releasePools();
  }

  /**
   * Builds the set the visibility currently describes, unless exactly that set already stands.
   * A pass finds nothing to do as long as the visibility hands back the same tile set and none
   * of the public fields of this class has moved since the last build. A value written into one
   * of those fields is in the picture with the next pass.
   *
   * On a disposed set this does nothing: no pass runs and no node is built.
   */
  update(): void {
    if (this.#disposed) return;
    if (!this.#show) return;
    // the manager refuses a node it cannot place, so nothing is built until there is a scene
    if (this.#helpers.scene == null) return;

    // asked on every pass and before the gate, never behind a `&&`: the state it keeps has to
    // follow every value written to those fields, not only the ones that fall on a pass that
    // rebuilds anyway
    const values = this.#knobValues;
    values.frustumBoxHelperColor = this.frustumBoxHelperColor;
    values.frustumBoxPrimaryHelperColor = this.frustumBoxPrimaryHelperColor;
    values.tileBoxHelperColor = this.tileBoxHelperColor;
    values.tileBoxPrimaryHelperColor = this.tileBoxPrimaryHelperColor;
    const colorsChanged = this.#knobs.changed(values);

    const seen = this.#seenKnobs;
    const numbersChanged =
      this.maxDebugHelpers !== seen[SEEN_MAX_DEBUG_HELPERS] ||
      this.tileBoxHelperExpand !== seen[SEEN_TILE_BOX_HELPER_EXPAND] ||
      this.frustumBoxHelperExpand !== seen[SEEN_FRUSTUM_BOX_HELPER_EXPAND];
    seen[SEEN_MAX_DEBUG_HELPERS] = this.maxDebugHelpers;
    seen[SEEN_TILE_BOX_HELPER_EXPAND] = this.tileBoxHelperExpand;
    seen[SEEN_FRUSTUM_BOX_HELPER_EXPAND] = this.frustumBoxHelperExpand;

    const knobsChanged = colorsChanged || numbersChanged;

    if (!knobsChanged && this.#builtSerial === this.cameraBasedVisibility.serial) return;

    this.#builtSerial = this.cameraBasedVisibility.serial;
    this.createHelpers();
  }

  /**
   * Takes the whole set down for good and gives up the scene it was handed. The manager
   * disposes every node it takes down, so geometry and material of the helper nodes go with
   * this call; the visibility this instance reads was handed in and is left as it is.
   *
   * Afterwards {@link isDisposed} is `true` and {@link show} answers `false`, while a write to
   * `show`, {@link add}, {@link remove}, {@link update} and a second {@link dispose} do
   * nothing. The public fields of this class still take values, and none of them has an effect
   * any more.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    // written directly and not through the setter: the setter would start the same work a
    // second time, and behind the guard above it would do nothing at all
    this.#show = false;
    // the manager takes every node out of the scene and the root above it and disposes it
    this.#helpers.scene = undefined;
    this.releasePools();
  }
}
