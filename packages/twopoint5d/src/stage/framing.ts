import type {Box3} from 'three/webgpu';
import {Plane, Vector3} from 'three/webgpu';

import {assertFiniteAtLeast} from '../utils/assertFiniteAtLeast.js';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {ProjectionPlane} from './ProjectionPlane.js';

/**
 * Where the camera looks at a box from: `'front'` from `+z` looking along `-z`, `'back'` from `-z`,
 * `'right'` from `+x`, `'left'` from `-x`, `'top'` from `+y` looking down, `'bottom'` from `-y`.
 * The up vector of the view is `+y` for the four sides around, `-z` for `'top'` and `+z` for
 * `'bottom'`.
 */
export type FramingSide = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

/**
 * The options of `ParallaxProjection.framing()` and `OrthographicProjection.framing()`: the side,
 * the margin and, beside them, the specs of the projection — `pixelSnap`, `distanceToProjectionPlane`,
 * `near`, `far` — that pass through. The fit is the framing's own (`'contain'`, the size of the
 * face), so a `fit`, `width` or `height` given here is replaced.
 */
export type FramingOptions<Specs> = {
  /** Where the camera looks at the box from. */
  side: FramingSide;
  /**
   * How far the view reaches beyond the face of the box, as a share of the extent of the face on
   * every edge: `0.1` shows the face 1.2 times as wide and as high. A finite number of 0 or more;
   * defaults to `0`.
   */
  margin?: number;
} & Partial<Specs>;

// side -> [normal, up, axis of the face right on the screen, axis of the face up on the screen]
const SIDES: Record<FramingSide, readonly [Vector3, Vector3, 'x' | 'y' | 'z', 'x' | 'y' | 'z']> = {
  front: [new Vector3(0, 0, 1), new Vector3(0, 1, 0), 'x', 'y'],
  back: [new Vector3(0, 0, -1), new Vector3(0, 1, 0), 'x', 'y'],
  right: [new Vector3(1, 0, 0), new Vector3(0, 1, 0), 'z', 'y'],
  left: [new Vector3(-1, 0, 0), new Vector3(0, 1, 0), 'z', 'y'],
  top: [new Vector3(0, 1, 0), new Vector3(0, 0, -1), 'x', 'z'],
  bottom: [new Vector3(0, -1, 0), new Vector3(0, 0, 1), 'x', 'z'],
};

const SIDE_NAMES = Object.keys(SIDES) as FramingSide[];

/**
 * A projection plane whose origin is a point of its own — the middle of a face — instead of the
 * point of the plane nearest to the world origin that `THREE.Plane#coplanarPoint()` answers: the
 * projections aim the camera at, and place it in front of, `getOrigin()`.
 */
class FacePlane extends ProjectionPlane {
  #origin: Vector3;

  constructor(plane: Plane, up: Vector3, origin: Vector3) {
    super(plane, up);
    this.#origin = origin.clone();
  }

  override getOrigin(target?: Vector3): Vector3 {
    return (target ?? new Vector3()).copy(this.#origin);
  }

  override clone(): ProjectionPlane {
    return new FacePlane(this.plane, this.up, this.#origin);
  }

  override equals(projectionPlane: ProjectionPlane): boolean {
    if (projectionPlane === this) return true;
    return projectionPlane instanceof FacePlane && super.equals(projectionPlane) && this.#origin.equals(projectionPlane.#origin);
  }
}

/**
 * The shared computation of the two `framing()`s: the projection plane in the face of `box` toward
 * `options.side`, and the specs of the projection — the other options, with a `'contain'` fit of
 * the face grown by the margin.
 *
 * @param subject - The call, for the message of a refusal: `'ParallaxProjection.framing()'`.
 * @internal
 */
export function framingSetup<Specs>(
  subject: string,
  box: Box3,
  options: FramingOptions<Specs>,
): {projectionPlane: ProjectionPlane; specs: Partial<Specs>} {
  if ((box as Partial<Box3> | null | undefined)?.isBox3 !== true) {
    throw new TypeError(`${subject}: box must be a THREE.Box3, got ${describeThreeValue(box, 'isObject3D')}`);
  }
  const {side, margin = 0, ...specs} = options ?? ({} as FramingOptions<Specs>);

  if (!Object.hasOwn(SIDES, side)) {
    throw new TypeError(
      `${subject}: side must be ${SIDE_NAMES.map((name) => describeValue(name)).join(', ')}, got ${describeValue(side)}`,
    );
  }
  assertFiniteAtLeast(margin, subject, 'margin', 0);
  if (box.isEmpty()) {
    throw new RangeError(`${subject}: the box is empty, there is no face to frame`);
  }

  const [normal, up, rightAxis, upAxis] = SIDES[side];
  const size = box.getSize(new Vector3());
  const width = size[rightAxis];
  const height = size[upAxis];
  if (!(width > 0 && height > 0)) {
    throw new RangeError(`${subject}: the face of the box toward ${describeValue(side)} has no area, got ${width} x ${height}`);
  }

  // the middle of the face toward the camera: the middle of the box, moved out to the side
  const origin = box.getCenter(new Vector3());
  const outward = normal.x + normal.y + normal.z;
  const axis = normal.x !== 0 ? 'x' : normal.y !== 0 ? 'y' : 'z';
  origin[axis] = outward > 0 ? box.max[axis] : box.min[axis];

  const projectionPlane = new FacePlane(new Plane().setFromNormalAndCoplanarPoint(normal, origin), up, origin);

  const grow = 1 + 2 * margin;
  return {
    projectionPlane,
    specs: {...specs, fit: 'contain', width: width * grow, height: height * grow} as unknown as Partial<Specs>,
  };
}
