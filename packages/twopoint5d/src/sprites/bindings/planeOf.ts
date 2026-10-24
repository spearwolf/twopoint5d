import {Matrix4, type Object3D, Plane, Vector3, Vector4} from 'three/webgpu';
import {assertFinite} from '../../utils/assertFinite.js';
import {describeValue} from '../../utils/describeValue.js';
import {isObject} from '../../utils/isObject.js';
import {isObject3D} from '../../utils/isObject3D.js';
import type {SpriteUniformSource} from './SpriteUniformSource.js';

const isPlane = (value: unknown): value is Plane => (value as {isPlane?: unknown} | null | undefined)?.isPlane === true;

const WHERE = 'planeOf';

// the normal and the constant of a plane handed in are calculated with: each one a finite number. A
// normal of (0, 0, 0) is no refusal — the passes draw nothing for it
function assertFinitePlane(plane: Plane, name: string): void {
  if (!isObject(plane.normal)) {
    throw new TypeError(`${WHERE}: ${name}.normal must be a Vector3, got ${describeValue(plane.normal)}`);
  }
  assertFinite(plane.normal.x, WHERE, `${name}.normal.x`);
  assertFinite(plane.normal.y, WHERE, `${name}.normal.y`);
  assertFinite(plane.normal.z, WHERE, `${name}.normal.z`);
  assertFinite(plane.constant, WHERE, `${name}.constant`);
}

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
 *
 * @throws {TypeError} for a target that is neither an `Object3D` nor a `Plane`, for options that are
 * no object, for an `options.plane` that is no `Plane`, and for a plane without a normal.
 * @throws {RangeError} for a plane whose normal or constant is no finite number.
 */
export function planeOf(node: Object3D, options?: {plane?: Plane}): SpriteUniformSource;
export function planeOf(plane: Plane): SpriteUniformSource;
export function planeOf(target: Object3D | Plane, options?: {plane?: Plane}): SpriteUniformSource {
  if (!isPlane(target) && !isObject3D(target)) {
    throw new TypeError(`${WHERE}: the target must be an Object3D or a Plane, got ${describeValue(target)}`);
  }
  if (isPlane(target)) {
    assertFinitePlane(target, 'plane');
  } else {
    if (options !== undefined && !isObject(options)) {
      throw new TypeError(`${WHERE}: the options must be an object, {plane?}, got ${describeValue(options)}`);
    }
    if (options?.plane !== undefined) {
      if (!isPlane(options.plane)) {
        throw new TypeError(`${WHERE}: options.plane must be a Plane, got ${describeValue(options.plane)}`);
      }
      assertFinitePlane(options.plane, 'options.plane');
    }
  }
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
