import {cameraPositionLocal, cameraRightLocal} from '../cameraNodes.js';
import {defineFeature, type SpriteFeature} from '../SpriteFeature.js';
import {axisBillboardVertex} from './axisBillboardVertex.js';

export interface AxisBillboardPlacementOptions {
  /**
   * The axis of the mesh the sprite turns about and stands along. `'y'`, the default, stands it up
   * along +Y — the ground is the XZ plane. `'z'` stands it up along +Z, for a mesh laid out in the
   * XY plane.
   */
  readonly axis?: 'y' | 'z';
}

// one feature per axis: the placement swap compares by identity, and the passes keep a copy of
// the placement of a kind keyed by the feature
const placements = new Map<string, SpriteFeature>();

/**
 * The axis billboard — a cylindrical billboard: turns every sprite about an axis of the mesh
 * through its instance position to face the camera, and keeps it upright along that axis. The
 * look of sprites standing in a 3D world under a camera that looks down at them: a spherical
 * `BillboardPlacement` leans back with such a camera, an axis billboard stands on its feet.
 *
 * Returns one frozen feature per axis, so equal options give the same feature;
 * `axisBillboardPlacement()` is {@link AxisBillboardPlacement}. It brings nothing but its placement
 * stage and swaps with `FlatPlacement`, every `flatPlacement()` and `BillboardPlacement` on a live
 * material.
 *
 * @throws a `TypeError` for an axis it does not know
 */
export function axisBillboardPlacement(options?: AxisBillboardPlacementOptions): SpriteFeature {
  const axis = options?.axis ?? 'y';
  if (axis !== 'y' && axis !== 'z') {
    throw new TypeError(`axisBillboardPlacement: the axis ${JSON.stringify(axis)} is neither 'y' nor 'z'`);
  }
  let feature = placements.get(axis);
  if (feature == null) {
    feature = defineFeature({
      name: axis === 'y' ? 'axisBillboardPlacement' : `axisBillboardPlacement+${axis}`,
      requires: ['instancePosition'],
      placement: (local, {attribute}) =>
        axisBillboardVertex({
          vertex: local,
          instancePosition: attribute<'vec3'>('instancePosition'),
          axis,
          cameraPosition: cameraPositionLocal(),
          cameraRight: cameraRightLocal(),
        }),
    });
    placements.set(axis, feature);
  }
  return feature;
}

/** The axis billboard upright along +Y of the mesh: `axisBillboardPlacement()`. */
export const AxisBillboardPlacement = axisBillboardPlacement();
