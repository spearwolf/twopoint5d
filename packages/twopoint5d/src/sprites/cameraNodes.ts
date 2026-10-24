import {cameraPosition, modelViewMatrix, modelWorldMatrixInverse, mul, normalize, vec3, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';

import {matrixColumn} from './matrixColumn.js';

/**
 * The camera position in the local space of the mesh: the camera position lives in world space,
 * and the inverse world matrix of the mesh brings it over. @internal
 */
export const cameraPositionLocal = (): Node<'vec3'> => mul(modelWorldMatrixInverse, vec4(cameraPosition, 1)).xyz;

// row `row` of the model-view rotation, normalized: an axis of the camera, expressed in the
// local space of the mesh. A mesh scaled evenly by s scales the rows by s; the direction is
// exact as long as the mesh is scaled evenly on all axes
const cameraAxisLocal = (row: 'x' | 'y' | 'z'): Node<'vec3'> =>
  normalize(
    vec3(matrixColumn(modelViewMatrix, 0)[row], matrixColumn(modelViewMatrix, 1)[row], matrixColumn(modelViewMatrix, 2)[row]),
  );

/** The right axis of the camera in the local space of the mesh, a unit vector. @internal */
export const cameraRightLocal = (): Node<'vec3'> => cameraAxisLocal('x');

/** The up axis of the camera in the local space of the mesh, a unit vector. @internal */
export const cameraUpLocal = (): Node<'vec3'> => cameraAxisLocal('y');

/** The back axis of the camera — away from where it looks — in the local space of the mesh, a unit vector. @internal */
export const cameraBackLocal = (): Node<'vec3'> => cameraAxisLocal('z');
