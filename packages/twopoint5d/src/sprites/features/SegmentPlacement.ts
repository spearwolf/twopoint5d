import {cameraPositionLocal, cameraRightLocal, cameraUpLocal} from '../cameraNodes.js';
import {defineFeature, type SpriteFeature, type SpriteKindShape} from '../SpriteFeature.js';
import {Rotation} from './Rotation.js';
import {refuseNineSliceOnSegments} from './segmentChecks.js';
import {Shear} from './Shear.js';
import {type SegmentFacing, segmentVertex} from './segmentVertex.js';

export interface SegmentPlacementOptions {
  /**
   * `'plane'`, the default, lays the segment into a plane of the mesh, its thickness across the
   * segment in that plane — the 2D case. `'camera'` turns the quad about the segment to face the
   * camera — the 3D case: a laser, a tracer, a rope seen from any side.
   */
  readonly facing?: 'plane' | 'camera';
  /** The plane of `facing: 'plane'`: `'xy'`, the default, or `'xz'`, the ground — as for `flatPlacement()`. */
  readonly plane?: 'xy' | 'xz';
}

// the local stages a segment cannot follow, and the names of their exports for the fix
const REFUSED: readonly [SpriteFeature, string][] = [
  [Rotation, 'Rotation'],
  [Shear, 'Shear'],
];

// also the check of a placement swap on a live material and of a pass that brings a segment placement
function checkSegmentKind(kind: SpriteKindShape): void {
  const held = REFUSED.filter(([feature]) => kind.features.includes(feature));
  if (held.length > 0) {
    const names = held.map(([feature]) => `"${feature.name}"`).join(' and ');
    const exports = held.map(([, name]) => name).join(' and ');
    throw new Error(
      `a segment lies along its ends, so it cannot follow the local ${held.length > 1 ? 'stages' : 'stage'} of ${names} — move the ends instead, and take ${exports} out of the kind`,
    );
  }
  refuseNineSliceOnSegments(kind);
}

// one feature per set of options: the placement swap compares by identity, and the passes keep a
// copy of the placement of a kind keyed by the feature
const placements = new Map<SegmentFacing, SpriteFeature>();

const NAMES: Readonly<Record<SegmentFacing, string>> = {
  xy: 'segmentPlacement',
  xz: 'segmentPlacement+xz',
  camera: 'segmentPlacement+camera',
};

/**
 * The placement of segment sprites: the quad of each sprite lies along a segment from its
 * `instancePosition` to its `segmentEnd` (the `SegmentEnd` feature). The base `uv.x` says where along
 * the segment a vertex lies; `QuadSize` keeps its meaning — `height` is the thickness, `width` the
 * extra length of the caps, half of it beyond each end. Across the segment it lies in the plane
 * (`facing: 'plane'`, `'xy'` or `'xz'`) or turns about the segment to face the camera
 * (`facing: 'camera'`). A segment of no length draws its caps quad, `width × height`.
 *
 * Returns one frozen feature per set of options: `segmentPlacement`, `segmentPlacement+xz` and
 * `segmentPlacement+camera`, which stand in for each other on a live material. A kind with
 * `Rotation` or `Shear` is refused: a segment lies along its ends. So is a kind with `NineSlice`,
 * which sets its border in the local quad, where a segment holds only its caps.
 *
 * @throws a `TypeError` for a facing or a plane it does not know, and for a plane next to
 *   `facing: 'camera'`
 */
export function segmentPlacement(options?: SegmentPlacementOptions): SpriteFeature {
  const facing = options?.facing ?? 'plane';
  if (facing !== 'plane' && facing !== 'camera') {
    throw new TypeError(`segmentPlacement: the facing ${JSON.stringify(facing)} is neither 'plane' nor 'camera'`);
  }
  if (facing === 'camera' && options?.plane !== undefined) {
    throw new TypeError(
      "segmentPlacement: a plane belongs to facing: 'plane' — a segment that faces the camera turns in every plane; drop the plane, or take facing: 'plane'",
    );
  }
  const plane = options?.plane ?? 'xy';
  if (plane !== 'xy' && plane !== 'xz') {
    throw new TypeError(`segmentPlacement: the plane ${JSON.stringify(plane)} is neither 'xy' nor 'xz'`);
  }

  const key: SegmentFacing = facing === 'camera' ? 'camera' : plane;
  let feature = placements.get(key);
  if (feature == null) {
    feature = defineFeature({
      name: NAMES[key],
      requires: ['instancePosition', 'segmentEnd'],
      checkKind: checkSegmentKind,
      placement: (local, {attribute}) =>
        segmentVertex({
          local,
          start: attribute<'vec3'>('instancePosition'),
          end: attribute<'vec3'>('segmentEnd'),
          along: attribute<'vec2'>('uv').x,
          facing: key,
          camera:
            key === 'camera' ? {position: cameraPositionLocal(), right: cameraRightLocal(), up: cameraUpLocal()} : undefined,
        }),
    });
    placements.set(key, feature);
  }
  return feature;
}

/** Segments in the XY plane of the mesh: `segmentPlacement()`. */
export const SegmentPlacement = segmentPlacement();
