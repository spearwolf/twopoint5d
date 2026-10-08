import {Matrix4, type Object3D, Plane, Vector3, Vector4} from 'three/webgpu';
import type {SpriteUniformSource} from './SpriteUniformSource.js';

const isPlane = (value: Object3D | Plane): value is Plane => (value as Plane).isPlane === true;

// c · m for the row vector c = [n, -d] of the plane dot(n, p) = d: the plane, carried through the
// map whose inverse is m, written into out as [n, d] again
function writeTransformedPlane(out: Vector4, c: Vector4, m: Matrix4): void {
  const e = m.elements;
  const x = c.x * e[0]! + c.y * e[1]! + c.z * e[2]! + c.w * e[3]!;
  const y = c.x * e[4]! + c.y * e[5]! + c.z * e[6]! + c.w * e[7]!;
  const z = c.x * e[8]! + c.y * e[9]! + c.z * e[10]! + c.w * e[11]!;
  const w = c.x * e[12]! + c.y * e[13]! + c.z * e[14]! + c.w * e[15]!;
  out.x = x;
  out.y = y;
  out.z = z;
  out.w = -w;
}

/**
 * A source for a plane uniform `[n.x, n.y, n.z, d]` (`dot(n, p) = d`) — `groundPlane`,
 * `mirrorPlane` — in the local space of the sprites.
 *
 * - With a node: its local XY plane, the normal +Z — the plane a `PlaneGeometry` lies in, its
 *   front face on the side the normal points to — or `options.plane` in the local space of the
 *   node, copied here. The node is read where it is in each frame; its world matrix is refreshed.
 * - With a `Plane`: that plane in world space, copied here. three's `Plane` is
 *   `dot(n, p) + constant = 0`, so `d` is `-constant`.
 *
 * The normal is not normalized. The sprites stand on the side the normal points to.
 */
export function planeOf(node: Object3D, options?: {plane?: Plane}): SpriteUniformSource;
export function planeOf(plane: Plane): SpriteUniformSource;
export function planeOf(target: Object3D | Plane, options?: {plane?: Plane}): SpriteUniformSource {
  const local = isPlane(target) ? target : (options?.plane ?? new Plane(new Vector3(0, 0, 1), 0));
  // the row vector [n, -d] = [n, constant]
  const c = new Vector4(local.normal.x, local.normal.y, local.normal.z, local.constant);
  const m = new Matrix4();

  if (isPlane(target)) {
    return {
      type: 'vec4',
      write(out, worldToSprites) {
        // world → sprites; the plane goes through the inverse of that map
        writeTransformedPlane(out, c, m.copy(worldToSprites).invert());
      },
    };
  }
  const node = target;
  return {
    type: 'vec4',
    write(out, worldToSprites) {
      node.updateWorldMatrix(true, false);
      // node → sprites is worldToSprites · matrixWorld; the plane goes through its inverse
      writeTransformedPlane(out, c, m.multiplyMatrices(worldToSprites, node.matrixWorld).invert());
    },
  };
}
