import {add, cos, cross, mul, sin, sub, vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {describeValue} from '../../utils/describeValue.js';
import {vertexByInstancePosition} from '../node-utils.js';
import {defineFeature, type SpriteFeature} from '../SpriteFeature.js';

export interface FlatPlacementOptions {
  /**
   * The plane of the mesh the quad lies in. `'xy'`, the default, faces +Z. `'xz'` lies on the
   * ground and faces +Y: the local x of the quad runs along +X, its y — the top of the image —
   * along −Z, its z along +Y, the turn a mesh takes with `rotation.x = -π/2`.
   */
  readonly plane?: 'xy' | 'xz';
  /**
   * Turns every sprite on its own, after the plane and before the instance position. `'yaw'` turns
   * it about +Y of the mesh by its `yaw` attribute; the kind has to hold the `Yaw` feature.
   * `'quaternion'` turns it by the unit quaternion of its `orientation` attribute — any tilt; the
   * kind has to hold the `Orientation` feature. Without it the sprites keep the facing of the plane.
   */
  readonly orientation?: 'yaw' | 'quaternion';
}

type Vec3 = Node<'vec3'>;

// the quad of the XY plane laid onto the ground: x stays, y goes to -z, z to +y
const onGround = (local: Vec3): Vec3 => vec3(local.x, local.z, local.y.negate());

// the turn of Object3D.rotation.y — counter-clockwise as seen from above — as one sine and one
// cosine, where rotate() of three/tsl builds a matrix for each of the three axes
const turnedAboutY = (v: Vec3, angle: Node<'float'>): Vec3 => {
  const c = cos(angle);
  const s = sin(angle);
  return vec3(add(mul(c, v.x), mul(s, v.z)), v.y, sub(mul(c, v.z), mul(s, v.x)));
};

// the turn of a unit quaternion, the one of Vector3#applyQuaternion: v + 2·q.xyz × (q.xyz × v + q.w·v),
// two cross products where a matrix would take nine products to build and nine to apply
const turnedBy = (v: Vec3, q: Node<'vec4'>): Vec3 => {
  const axis = q.xyz;
  return add(v, mul(2, cross(axis, add(cross(axis, v), mul(q.w, v)))));
};

// one feature per set of options: the placement swap compares by identity, and the passes keep a
// copy of the placement of a kind keyed by the feature
const placements = new Map<string, SpriteFeature>();

/**
 * The flat placement for a plane, optionally turned per sprite: `instancePosition + turn · plane ·
 * local`. Returns one frozen feature per set of options, so equal options give the same feature;
 * `flatPlacement()` is {@link FlatPlacement}, `flatPlacement({plane: 'xz'})` is {@link GroundPlacement}.
 *
 * @throws a `TypeError` for a plane or an orientation it does not know
 */
export function flatPlacement(options?: FlatPlacementOptions): SpriteFeature {
  const plane = options?.plane ?? 'xy';
  const orientation = options?.orientation;
  if (plane !== 'xy' && plane !== 'xz') {
    throw new TypeError(`flatPlacement: the plane ${describeValue(plane)} is neither 'xy' nor 'xz'`);
  }
  if (orientation !== undefined && orientation !== 'yaw' && orientation !== 'quaternion') {
    throw new TypeError(`flatPlacement: the orientation ${describeValue(orientation)} is neither 'yaw' nor 'quaternion'`);
  }

  const key = orientation == null ? plane : `${plane}+${orientation}`;
  let feature = placements.get(key);
  if (feature == null) {
    const base = plane === 'xz' ? 'groundPlacement' : 'flatPlacement';
    // the feature that holds the attribute of the turn bears the name of that attribute
    const turnAttribute = orientation === 'quaternion' ? 'orientation' : orientation;
    feature = defineFeature({
      name: orientation == null ? base : `${base}+${orientation}`,
      requires: turnAttribute == null ? ['instancePosition'] : ['instancePosition', turnAttribute],
      placement: (local, {attribute}) => {
        let vertex = plane === 'xz' ? onGround(local) : local;
        if (orientation === 'yaw') vertex = turnedAboutY(vertex, attribute<'float'>('yaw'));
        if (orientation === 'quaternion') vertex = turnedBy(vertex, attribute<'vec4'>('orientation'));
        return vertexByInstancePosition({vertexPosition: vertex, instancePosition: attribute<'vec3'>('instancePosition')});
      },
    });
    placements.set(key, feature);
  }
  return feature;
}

/** Places the sprite flat in the XY plane of its mesh, facing +Z, at its instance position. */
export const FlatPlacement = flatPlacement();

/**
 * Lays the sprite flat on the XZ plane of its mesh, facing +Y, at its instance position: the top
 * of the image points to −Z, and `Rotation` turns the sprite about +Y. The plane of `Map2D`,
 * `TileSprites` and the `groundPlane` of `ShadowPass`.
 */
export const GroundPlacement = flatPlacement({plane: 'xz'});
