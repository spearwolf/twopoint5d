import type {DirectionalLight, Object3D, Vector4} from 'three/webgpu';
import {describeValue} from '../../utils/describeValue.js';
import type {SpriteUniformSource} from './SpriteUniformSource.js';

const isObject3D = (value: unknown): value is Object3D =>
  (value as {isObject3D?: unknown} | null | undefined)?.isObject3D === true;

const isDirectionalLight = (node: Object3D): node is DirectionalLight => (node as DirectionalLight).isDirectionalLight === true;

/**
 * A source for a homogeneous light uniform `[x, y, z, w]` — `shadowLight` — in the local space of
 * the sprites:
 *
 * - a `DirectionalLight`: `w = 0` and the direction towards the light, from its `target` to it.
 *   Light and target are read where they are in each frame, the target outside the scene as well.
 * - any other node — `PointLight`, `SpotLight` (its cone is ignored), an `Object3D` as a lamp:
 *   `w = 1` and its position, a point light.
 *
 * An `AmbientLight` or a `HemisphereLight` is taken as any node; its position means nothing.
 *
 * @throws {TypeError} for a node that is no `Object3D`.
 */
export function lightOf(node: Object3D): SpriteUniformSource {
  if (!isObject3D(node)) {
    throw new TypeError(`lightOf: the node must be an Object3D — a light or a node that marks one —, got ${describeValue(node)}`);
  }
  if (isDirectionalLight(node)) {
    return {
      type: 'vec4',
      write(out: Vector4, worldToSprites) {
        node.updateWorldMatrix(true, false);
        node.target.updateWorldMatrix(true, false);
        const l = node.matrixWorld.elements;
        const t = node.target.matrixWorld.elements;
        const x = l[12]! - t[12]!;
        const y = l[13]! - t[13]!;
        const z = l[14]! - t[14]!;
        const e = worldToSprites.elements;
        // a direction: the linear part of the map alone
        out.x = e[0]! * x + e[4]! * y + e[8]! * z;
        out.y = e[1]! * x + e[5]! * y + e[9]! * z;
        out.z = e[2]! * x + e[6]! * y + e[10]! * z;
        out.w = 0;
      },
    };
  }
  return {
    type: 'vec4',
    write(out: Vector4, worldToSprites) {
      node.updateWorldMatrix(true, false);
      const p = node.matrixWorld.elements;
      const e = worldToSprites.elements;
      out.x = e[0]! * p[12]! + e[4]! * p[13]! + e[8]! * p[14]! + e[12]!;
      out.y = e[1]! * p[12]! + e[5]! * p[13]! + e[9]! * p[14]! + e[13]!;
      out.z = e[2]! * p[12]! + e[6]! * p[13]! + e[10]! * p[14]! + e[14]!;
      out.w = 1;
    },
  };
}
