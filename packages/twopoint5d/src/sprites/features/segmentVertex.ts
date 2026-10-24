import {add, cross, div, dot, length, max, mix, mul, step, sub, vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';

type Vec3 = Node<'vec3'>;

/** How a segment lies: in the XY or the XZ plane of the mesh, or turned about itself to the camera. @internal */
export type SegmentFacing = 'xy' | 'xz' | 'camera';

// shorter than this a segment, an across or a look counts as none, and the fallbacks take over
const NO_LENGTH = 1e-6;

// within this sine between the segment and the direction towards the camera, the across of a
// segment that faces the camera turns over to the up of the camera: along the look it is undefined
const ZENITH_SINE = 0.1;

// v divided by its length, or the zero vector for one of no length — never NaN
const unitOf = (v: Vec3): Vec3 => div(v, max(length(v), NO_LENGTH));

// `value` where `size` reaches NO_LENGTH, `fallback` below it: a switch without a branch
const orFallback = (fallback: Vec3, value: Vec3, size: Node<'float'>): Vec3 => mix(fallback, value, step(NO_LENGTH, size));

/**
 * The vertex of a quad laid along a segment from `start` to `end`: `along` (the base uv.x, 0 at the
 * start and 1 at the end) picks the point on the segment, the local x moves on along it — the caps —
 * and the local y across it — the thickness. All in the local space of the mesh.
 *
 * Across the segment is the left of its direction in the plane (`'xy'`, `'xz'`, the image upright for
 * a segment from left to right), or `look × dir` to face the camera position (`'camera'`), turned
 * over to the camera's up within a sine of 0.1 of the look. A segment of no length takes `+X` — or
 * the right of the camera — as its direction, an across of no length the plane's up: nothing is NaN.
 *
 * @internal
 */
export function segmentVertex(params: {
  local: Vec3;
  start: Vec3;
  end: Vec3;
  along: Node<'float'>;
  facing: SegmentFacing;
  /** The camera in the local space of the mesh, for `facing: 'camera'`: `right` and `up` are unit vectors. */
  camera?: {readonly position: Vec3; readonly right: Vec3; readonly up: Vec3};
}): Vec3 {
  const {local, start, end, along, facing, camera} = params;
  const segment = sub(end, start);
  const size = length(segment);
  const point = add(start, mul(segment, along));

  let dir: Vec3;
  let across: Vec3;
  if (facing === 'camera') {
    dir = orFallback(camera!.right, unitOf(segment), size);
    const look = unitOf(sub(camera!.position, point));
    const facingAcross = cross(look, dir);
    const weight = max(sub(1, div(length(facingAcross), ZENITH_SINE)), 0);
    // the up of the camera less its part along the segment, to the side of the facing across so
    // that the two never cancel
    const level = sub(camera!.up, mul(dir, dot(camera!.up, dir)));
    const side = sub(mul(step(0, dot(level, facingAcross)), 2), 1);
    across = unitOf(add(facingAcross, mul(level, mul(side, weight))));
  } else {
    dir = orFallback(vec3(1, 0, 0), unitOf(segment), size);
    // the left of the direction in the plane: the quad of a segment along +X keeps the facing of a
    // flat sprite of that plane — +Y up and +Z out in 'xy', −Z up and +Y out in 'xz'
    const inPlane = facing === 'xy' ? vec3(segment.y.negate(), segment.x, 0) : vec3(segment.z, 0, segment.x.negate());
    const up = facing === 'xy' ? vec3(0, 1, 0) : vec3(0, 0, -1);
    across = orFallback(up, unitOf(inPlane), length(inPlane));
  }
  const normal = cross(dir, across);

  return add(point, add(add(mul(dir, local.x), mul(across, local.y)), mul(normal, local.z)));
}
