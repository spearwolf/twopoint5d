import {add, cos, mul, sin, sub, vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';
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
   * `'yaw'` turns every sprite about +Y of the mesh by its `yaw` attribute, after the plane and
   * before the instance position; the kind has to hold the `Yaw` feature. Without it the sprites
   * keep the facing of the plane.
   */
  readonly orientation?: 'yaw';
}

type Vec3 = Node<'vec3'>;

// the quad of the XY plane laid onto the ground: x stays, y goes to -z, z to +y
const onGround = (local: Vec3): Vec3 => vec3(local.x, local.z, local.y.negate()) as unknown as Vec3;

// the turn of Object3D.rotation.y — counter-clockwise as seen from above — as one sine and one
// cosine, where rotate() of three/tsl builds a matrix for each of the three axes
const turnedAboutY = (v: Vec3, angle: Node<'float'>): Vec3 => {
  const c = cos(angle);
  const s = sin(angle);
  return vec3(add(mul(c, v.x), mul(s, v.z)), v.y, sub(mul(c, v.z), mul(s, v.x))) as unknown as Vec3;
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
    throw new TypeError(`flatPlacement: the plane ${JSON.stringify(plane)} is neither 'xy' nor 'xz'`);
  }
  if (orientation !== undefined && orientation !== 'yaw') {
    throw new TypeError(`flatPlacement: the orientation ${JSON.stringify(orientation)} is not 'yaw'`);
  }

  const key = orientation == null ? plane : `${plane}+${orientation}`;
  let feature = placements.get(key);
  if (feature == null) {
    const base = plane === 'xz' ? 'groundPlacement' : 'flatPlacement';
    const yaw = orientation === 'yaw';
    feature = defineFeature({
      name: yaw ? `${base}+yaw` : base,
      requires: yaw ? ['instancePosition', 'yaw'] : ['instancePosition'],
      placement: (local, {attribute}) => {
        let vertex = plane === 'xz' ? onGround(local) : local;
        if (yaw) vertex = turnedAboutY(vertex, attribute<'float'>('yaw'));
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
